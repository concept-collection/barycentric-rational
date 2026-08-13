// The MATLAB sources, inlined into the bundle at build time.
//
// driver.m is not a workspace file of its own: it is prepended to whichever
// method script is in the editor, so that the functions the method defines are
// local functions of the driver and are visible to it.  Everything in
// src/matlab/lib is a genuine function file and goes into the session as is.
import type { BootFile } from 'numbl/browser'

import driverSrc from '../matlab/driver.m?raw'

const libRaw = import.meta.glob('../matlab/lib/*.m', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const DRIVER = driverSrc

export const LIB_FILES: BootFile[] = Object.entries(libRaw).map(([path, content]) => ({
  path: path.slice(path.lastIndexOf('/') + 1),
  content,
}))

/** The files a session boots with, for a given method script. */
export function bootFiles(methodScript: string): BootFile[] {
  return [
    ...LIB_FILES,
    { path: 'main.m', content: `${DRIVER}\n${methodScript}` },
    // params.json is overwritten before every run; it only needs to exist so
    // that the first fileread has something to find.
    { path: 'params.json', content: '{}' },
  ]
}
