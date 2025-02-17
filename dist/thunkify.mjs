/**
 * rubico v1.9.3
 * https://github.com/a-synchronous/rubico
 * (c) 2019-2021 Richard Tong
 * rubico may be freely distributed under the MIT license.
 */

const thunkify = (func, ...args) => function thunk() {
  return func(...args)
}

export default thunkify
