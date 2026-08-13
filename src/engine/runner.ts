// Runs the MATLAB layer in a numbl session.
//
// A session is booted once per method script and then reused: parameter
// changes only rewrite params.json and re-run main.m, which is fast enough to
// drive sliders.  Editing the script needs a fresh session, because the
// functions the script defines are compiled into main.m at boot.
import { createNumblSession, type NumblSession } from 'numbl/browser'
import { bootFiles } from './files.ts'
import type { Params, RunResult } from './types.ts'

export class Engine {
  private session: NumblSession | null = null
  private bootedFor: string | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private chunks: string[] = []

  /** Resolves when the run finishes; runs are serialised in call order. */
  run<T>(script: string, params: Params): Promise<RunResult<T>> {
    const task = this.queue.then(
      () => this.exec<T>(script, params),
      () => this.exec<T>(script, params),
    )
    // keep the chain alive whatever happens to this task
    this.queue = task.catch(() => undefined)
    return task
  }

  private async exec<T>(script: string, params: Params): Promise<RunResult<T>> {
    const t0 = performance.now()
    const fail = (error: string): RunResult<T> => ({
      ok: false,
      error,
      output: this.chunks.join(''),
      ms: performance.now() - t0,
    })

    try {
      if (!this.session || this.bootedFor !== script) {
        this.session?.dispose()
        this.session = null
        this.bootedFor = null
        this.chunks = []
        const session = await createNumblSession({
          files: bootFiles(script),
          mip: false,
          persistSystem: false,
          optimization: '1',
          onOutput: (text) => {
            this.chunks.push(text)
          },
        })
        this.session = session
        this.bootedFor = script
      }

      this.chunks = []
      this.session.writeFile('params.json', JSON.stringify(params))
      // run('main.m'), not `main;`.  numbl (0.4.18) mis-binds the arguments of
      // a script's local functions when the script is invoked by name from the
      // REPL, which is what session.execute gives us: the callee sees its
      // parameters as undefined.  Going through run() binds them correctly.
      const res = await this.session.execute("run('main.m');")
      if (!res.ok) return fail(res.error ?? 'the script failed')

      const bytes = await this.session.readFile('out.json')
      return {
        ok: true,
        data: JSON.parse(new TextDecoder().decode(bytes)) as T,
        output: this.chunks.join(''),
        ms: performance.now() - t0,
      }
    } catch (err) {
      // A boot failure leaves nothing usable behind; drop the session so the
      // next run starts over rather than reusing a half-built one.
      this.session?.dispose()
      this.session = null
      this.bootedFor = null
      return fail(err instanceof Error ? err.message : String(err))
    }
  }

  dispose() {
    this.session?.dispose()
    this.session = null
    this.bootedFor = null
  }
}
