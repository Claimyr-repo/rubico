/**
 * rubico v1.9.3
 * https://github.com/a-synchronous/rubico
 * (c) 2019-2021 Richard Tong
 * rubico may be freely distributed under the MIT license.
 */

const isPromise = value => value != null && typeof value.then == 'function'

const always = value => function getter() { return value }

const tapSync = func => function tapping(...args) {
  func(...args)
  return args[0]
}

const thunkifyArgs = (func, args) => function thunk() {
  return func(...args)
}

const thunkConditional = (
  conditionalExpression, thunkOnTruthy, thunkOnFalsy,
) => conditionalExpression ? thunkOnTruthy() : thunkOnFalsy()

const __ = Symbol.for('placeholder')

// argument resolver for curry3
const curry3ResolveArg0 = (
  baseFunc, arg1, arg2,
) => function arg0Resolver(arg0) {
  return baseFunc(arg0, arg1, arg2)
}

// argument resolver for curry3
const curry3ResolveArg1 = (
  baseFunc, arg0, arg2,
) => function arg1Resolver(arg1) {
  return baseFunc(arg0, arg1, arg2)
}

// argument resolver for curry3
const curry3ResolveArg2 = (
  baseFunc, arg0, arg1,
) => function arg2Resolver(arg2) {
  return baseFunc(arg0, arg1, arg2)
}

const curry3 = function (baseFunc, arg0, arg1, arg2) {
  if (arg0 == __) {
    return curry3ResolveArg0(baseFunc, arg1, arg2)
  }
  if (arg1 == __) {
    return curry3ResolveArg1(baseFunc, arg0, arg2)
  }
  return curry3ResolveArg2(baseFunc, arg0, arg1)
}

const tap = func => function tapping(...args) {
  const result = args[0],
    call = func(...args)
  return isPromise(call) ? call.then(always(result)) : result
}

tap.sync = tapSync

tap.if = (predicate, func) => function tappingIf(...args) {
  const predication = predicate(...args)
  if (isPromise(predication)) {
    return predication.then(curry3(
      thunkConditional, __, thunkifyArgs(tap(func), args), always(args[0])))
  }
  if (predication) {
    const execution = func(...args)
    if (isPromise(execution)) {
      return execution.then(always(args[0]))
    }
  }
  return args[0]
}

export default tap
