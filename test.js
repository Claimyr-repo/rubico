const assert = require('assert')
const stream = require('stream')
const path = require('path')
const fs = require('fs')
const rubico = require('.')
const isDeepEqual = require('./x/isDeepEqual')
const { Readable, Writable } = require('stream')

const {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform, flatMap,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
} = rubico

const objectProto = Object.prototype

const symbolAsyncIterator = Symbol.asyncIterator

const nativeObjectToString = objectProto.toString

const objectToString = x => nativeObjectToString.call(x)

const ase = assert.strictEqual

const ade = assert.deepEqual

const aok = assert.ok

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms) })

const hi = x => x + 'hi'

const ho = x => x + 'ho'

const isOdd = x => (x % 2 === 1)

const square = x => x ** 2

const arrayOf = (getter, length) => Array.from(
  { length },
  typeof getter === 'function' ? getter : () => getter,
)

const asyncIsEven = x => new Promise(resolve => {
  setImmediate(() => resolve(x % 2 === 0))
})

const asyncHey = x => new Promise(resolve => {
  setImmediate(() => resolve(x + 'hey'))
})

const asyncMult = (y, xi) => new Promise(resolve => {
  setImmediate(() => resolve(y * xi))
})

const asyncArrayReduce = (fn, x0) => async x => {
  if (x.length < 2) throw new Error('array must have length >= 2')
  let y, i
  if (x0 === undefined || x0 === null) {
    y = await fn(x[0], x[1])
    i = 2
  } else {
    y = await fn(x0, x[0])
    i = 1
  }
  while (i < x.length) { y = await fn(y, x[i]); i += 1 }
  return y
}

const constructReadStream = iterable => {
  const y = new stream.Readable({ objectMode: true })
  y._read = () => {}
  for (const x of iterable) y.push(x)
  y.push(null)
  return y
}

const readStreamToArray = readStream => new Promise((resolve, reject) => {
  let result = ''
  readStream.on('data', chunk => (result += chunk))
  readStream.on('end', () => resolve(result))
  readStream.on('error', reject)
})

const consumeReadStreamPush = s => new Promise((resolve, reject) => {
  let y = ''
  s.on('data', chunk => { y += chunk })
  s.on('end', () => resolve(y))
  s.on('error', err => reject(err))
})

const consumeReadStreamPull = s => new Promise((resolve, reject) => {
  let y = ''
  s.on('readable', () => {
    let chunk
    while (chunk = s.read()) y += `${chunk}`
  })
  s.on('end', () => resolve(y))
  s.on('error', err => reject(err))
})

const makeNumbers = function*() {
  for (let i = 0; i < 5; i++) yield i + 1
}

const makeAsyncNumbers = async function*() {
  for (let i = 0; i < 5; i++) yield i + 1
}

const iteratorToArray = x => {
  let isAsync = false
  const y = []
  for (const xi of x) {
    if (xi instanceof Promise) isAsync = true
    y.push(xi)
  }
  return isAsync ? Promise.all(y) : y
}

const asyncIteratorToArray = async x => {
  const y = []
  for await (const xi of x) y.push(xi)
  return y
}

const typedArrayConstructors = [
  Uint8ClampedArray,
  Uint8Array, Int8Array,
  Uint16Array, Int16Array,
  Uint32Array, Int32Array,
  Float32Array, Float64Array,
  BigUint64Array, BigInt64Array,
]

const numberTypedArrayConstructors = [
  Uint8ClampedArray,
  Uint8Array, Int8Array,
  Uint16Array, Int16Array,
  Uint32Array, Int32Array,
  Float32Array, Float64Array,
]

const bigIntTypedArrayConstructors = [
  BigUint64Array, BigInt64Array,
]

const AssertionError = function (message) {
  this.message = message
  this.stack = new Error().stack
}

/* Assertion.test(reduce(add, 0), {
  args: { 0: [1, 2, 3, 4, 5] },
  result: 15,
}) */

const prettify = value => JSON.stringify(value, null, 2)

const Assertion = (func, result, ...args) => async function test() {
  const evaluatedResult = await func(...args)
  if (isDeepEqual(result, evaluatedResult)) {
    return undefined
  }
  throw new AssertionError(`
${func.toString()}

args - ${prettify(args)}

expected - ${prettify(result)}

actual - ${prettify(evaluatedResult)}
`)
}

const binaryToReadableStream = function (binary) {
  return new Readable({
    read() {
      this.push(binary)
      this.push(null)
    },
  })
}

const arrayToObjectReadableStream = function (array) {
  return new Readable({
    objectMode: true,
    read() {
      for (const item of array) {
        this.push(item)
      }
      this.push(null)
    },
  })
}

const MockWritable = function (array = []) {
  Writable.call(this)
  this.array = array
  this.handlers = new Map()
}

MockWritable.prototype = {
  write(chunk, encoding, callback) {
    this.array.push(chunk)
  },
  on(eventName, handler) {
    if (this.handlers.has(eventName)) {
      this.handlers.get(eventName).push(handler)
    } else {
      this.handlers.set(eventName, [handler])
    }
  },
  once(eventName, handler) {
    this.handlers.set(eventName, [handler])
  },
  emit(eventName, ...args) {
    if (!this.handlers.has(eventName)) {
      return undefined
    }
    return this.handlers.get(eventName).map(handler => handler(...args))
  }
}

const MockDuplexStream = function (values) {
  MockWritable.call(this)
  this.values = [...values]
}

MockDuplexStream.prototype = {
  ...MockWritable.prototype,
  async* [symbolAsyncIterator]() {
    for (const item of this.values) {
      yield item
    }
  },
}

const MockFoldable = function (values) {
  this.values = values
}

MockFoldable.prototype = {
  reduce(reducer, init) {
    return this.values.reduce(reducer, init)
  },
}

describe('rubico', () => {
  describe('pipe', () => {
    it('chains async and regular functions together', async () => {
      ase(await pipe([hi, ho, asyncHey])('yo'), 'yohihohey')
    })
    it('chains functions in reverse if passed a function (very contrived)', async () => {
      ase(await pipe([hi, ho, asyncHey])((y, xi) => y + xi), '(y, xi) => y + xiheyhohi')
      ase(await pipe([asyncHey, ho, hi])((y, xi) => y + xi), '(y, xi) => y + xihihohey')
    })
    it('does something without arguments', async () => {
      ase(await pipe([hi, ho, asyncHey])(), 'undefinedhihohey')
    })
    it('chaining one fn is the same as just calling that fn', async () => {
      ase(await pipe([asyncHey])('yo'), await asyncHey('yo'))
    })
    it('returns the raw value (no promise required) if all functions are sync', async () => {
      ase(pipe([hi, hi, hi])('yo'), 'yohihihi')
    })
    it('returns a promise if any fns async', async () => {
      aok(pipe([hi, hi, hi, asyncHey])('yo') instanceof Promise)
    })
    it('pipe(Array<GeneratorFunction>)(Generator)', async () => {
      const numbersGen = function* () {
        yield 1; yield 2; yield 3; yield 4; yield 5
      }
      const isOddGen = function* (iter) {
        for (const item of iter) {
          if (item % 2 == 1) yield item
        }
      }
      const squareGen = function* (iter) {
        for (const item of iter) {
          yield item ** 2
        }
      }
      const iter = pipe([isOddGen, squareGen])(numbersGen())
      const arr = [...iter]
      assert.deepEqual(arr, [1, 9, 25])
    })
    it('pipe(Array<AsyncGeneratorFunction>)(AsyncGenerator)', async () => {
      const asyncNumbersGen = async function* () {
        yield 1; yield 2; yield 3; yield 4; yield 5
      }
      const isOddGen = async function* (iter) {
        for await (const item of iter) {
          if (item % 2 == 1) yield item
        }
      }
      const squareGen = async function* (iter) {
        for await (const item of iter) {
          yield item ** 2
        }
      }
      const iter = pipe([isOddGen, squareGen])(asyncNumbersGen())
      const arr = []
      for await (const item of iter) arr.push(item)
      assert.deepEqual(arr, [1, 9, 25])
    })
    it('throws a TypeError if first argument not an array', async () => {
      assert.throws(
        () => {
          pipe(() => 1, undefined, () => 2)()
        },
        new TypeError('funcs.reduce is not a function')
      )
    })
    it('throws a TypeError if passed less than one function', async () => {
      assert.throws(
        () => pipe([])(),
        new TypeError('Reduce of empty array with no initial value'),
      )
    })
    it('throws a TypeError if any arguments are not a function', async () => {
      assert.throws(
        () => {
          pipe([() => 1, undefined, () => 2])()
        },
        new TypeError('funcB is not a function'),
      )
    })
    it('handles sync errors good', async () => {
      assert.throws(
        () => pipe([hi, hi, x => { throw new Error(`throwing ${x}`) }])('yo'),
        new Error('throwing yohihi'),
      )
    })
    it('handles async errors good', async () => {
      assert.rejects(
        () => pipe([hi, asyncHey, x => { throw new Error(`throwing ${x}`) }])('yo'),
        new Error('throwing yohihey'),
      )
    })
  })

  describe('fork', () => {
    it('maps input to array of sync functions', async () => {
      ade(fork([hi, hi, hi])('yo'), ['yohi', 'yohi', 'yohi'])
    })
    it('maps input to object of sync functions', async () => {
      ade(
        fork({ a: hi, b: hi, c: hi })('yo'),
        { a: 'yohi', b: 'yohi', c: 'yohi' },
      )
    })
    it('maps input to array of async functions', async () => {
      aok(fork([asyncHey, asyncHey, asyncHey])('yo') instanceof Promise)
      ade(
        await fork([asyncHey, asyncHey, asyncHey])('yo'),
        ['yohey', 'yohey', 'yohey'],
      )
    })
    it('maps input to object of async functions', async () => {
      aok(fork({ a: asyncHey, b: asyncHey, c: asyncHey })('yo') instanceof Promise)
      ade(
        await fork({ a: asyncHey, b: asyncHey, c: asyncHey })('yo'),
        { a: 'yohey', b: 'yohey', c: 'yohey' },
      )
    })
    it('any functions async => Promise', async () => {
      aok(fork([asyncHey, asyncHey, hi])('yo') instanceof Promise)
      ade(
        await fork([asyncHey, asyncHey, hi])('yo'),
        ['yohey', 'yohey', 'yohi'],
      )
    })
    it('fork([])() -> []', async () => {
      ade(fork([])(), [])
      ade(fork([])('hey'), [])
    })
    it('fork({})() -> {}', async () => {
      ade(fork({})(), {})
      ade(fork({})('hey'), {})
    })
    it('TypeError for fork([\'hey\'])()', async () => {
      assert.throws(
        () => fork(['hey'])(),
        new TypeError('funcs[funcsIndex] is not a function'),
      )
    })
    it('throws TypeError for fork({ a: nonFunction })', async () => {
      assert.throws(
        () => fork({ a: 'hey' })(),
        new TypeError('funcs[key] is not a function'),
      )
    })
    it('throws TypeError for String', async () => {
      assert.throws(
        () => fork('ayelmao')(),
        new TypeError('funcs[key] is not a function'),
      )
    })
    it('{} for Set<[func]>; no functions exposed via in', async () => {
      assert.deepEqual(fork(new Set([() => 'yo']))('hey'), {})
    })
    it('{} for Map<[[1, func]]>', async () => {
      assert.deepEqual(fork(new Map([[1, () => 'yo']]))('hey'), {})
    })
  })

  describe('fork.series', () => {
    it('syncly forks into array of functions', async () => {
      const arr = []
      ade(
        fork.series([
          () => { arr.push(1); return 'a' },
          () => { arr.push(2); return 'b' },
          () => { arr.push(3); return 'c' },
        ])(),
        ['a', 'b', 'c']
      )
      ade(arr, [1, 2, 3])
    })
    it('asyncly forks into array of functions, running each function in series', async () => {
      const arr = []
      const staggeredPush = fork.series([
        () => sleep(10).then(() => { arr.push(1); return 'a' }),
        () => sleep(5).then(() => { arr.push(2); return 'b' }),
        () => { arr.push(3); return 'c' },
      ])()
      aok(staggeredPush instanceof Promise)
      ade(await staggeredPush, ['a', 'b', 'c'])
      ade(arr, [1, 2, 3])
      const arr2 = []
      const parallelPush = fork([
        () => sleep(10).then(() => { arr2.push(1); return 'a' }),
        () => sleep(5).then(() => { arr2.push(2); return 'b' }),
        () => { arr2.push(3); return 'c' },
      ])()
      aok(parallelPush instanceof Promise)
      ade(await parallelPush, ['a', 'b', 'c'])
      ade(arr2, [3, 2, 1])
    })
    it('throws TypeError for fork([])', async () => {
      assert.deepEqual(fork.series([])(), [])
    })
    it('throws TypeError for fork([nonFunction])', async () => {
      assert.throws(
        () => fork.series(['hey'])(),
        new TypeError('funcs[funcsIndex] is not a function')
      )
    })
    it('defaults to array', async () => {
      assert.deepEqual(fork.series({})(), [])
    })
  })

  describe('assign', () => {
    it('maps input to object of sync functions then merges', async () => {
      ade(
        assign({
          b: x => x.a + 'yo',
          c: x => x.a + 'yaya',
        })({ a: 'a' }),
        { a: 'a', b: 'ayo', c: 'ayaya' },
      )
    })
    it('maps input to object of async functions then merges', async () => {
      aok(assign({
        b: async x => x.a + 'yo',
        c: async x => x.a + 'yaya',
      })({ a: 'a' }) instanceof Promise)
      ade(
        await assign({
          b: async x => x.a + 'yo',
          c: async x => x.a + 'yaya',
        })({ a: 'a' }),
        { a: 'a', b: 'ayo', c: 'ayaya' },
      )
    })
    it('assign(Set)(nonObject) -> {}', async () => {
      assert.deepEqual(assign(new Set(['hey']))(), {})
    })
    it('assign(...)(string) -> { 0: s, 1: t, ... }', async () => {
      assert.deepEqual(
        assign({ a: value => value })('hi'),
        { '0': 'h', '1': 'i', a: 'hi' },
      )
    })
  })

  describe('tap', () => {
    it('[sync] calls a provided function with input, returning input', async () => {
      ase(tap(x => x + 1)(1), 1)
    })
    it('[async] calls a provided function with input, returning input', async () => {
      aok(tap(async x => x + 1)(1) instanceof Promise)
      ase(await tap(async x => x + 1)(1), 1)
    })
    it('multiple arguments', async () => {
      const array = []
      const point = tap((...args) => (array.push(...args)))(1, 2, 3, 4, 5)
      assert.strictEqual(point, 1)
      assert.deepEqual(array, [1, 2, 3, 4, 5])
    })
    it('throws a TypeError if passed a non function', async () => {
      assert.throws(
        () => tap('hey')(),
        new TypeError('func is not a function'),
      )
    })
  })

  describe('tap.if', () => {
    xit('[sync] tap.if(condition, f); conditional tap; only calls fn on truthy condition', async () => {
      const isOdd = x => x % 2 === 1
      const oddNumbers = []
      ade(
        tap.if(isOdd, number => oddNumbers.push(number))([1, 2, 3, 4, 5]),
        [1, 2, 3, 4, 5],
      )
      ade(oddNumbers, [1, 3, 5])
    })
    xit('[async] tap.if(condition, f); conditional tap; only calls fn on truthy condition')
    xit('throws TypeError on tap.if(nonFunction, f)()')
    xit('throws TypeError on tap.if(condition, nonFunction)()')
    xit('handles errors thrown from condition of tap.if(condition, f)()')
    xit('handles errors thrown from f of tap.if(condition, f)')
  })

  describe('tryCatch', () => {
    it('tries a sync function and catches with a sync function', async () => {
      const errProp = (err, x) => { err.x = x; return err }
      const throwError = x => { throw new Error(x) }
      ase(tryCatch(x => x + 1, errProp)(1), 2)
      const e1 = tryCatch(throwError, errProp)(1)
      aok(e1 instanceof Error)
      ase(e1.name, 'Error')
      ase(e1.message, '1')
      ase(e1.x, 1)
    })
    it('tries an async function and catches with a sync function', async () => {
      const errProp = (err, x) => { err.x = x; return err }
      const asyncThrowError = async x => { throw new Error(x) }
      const reject = x => Promise.reject(new Error(x))
      aok(tryCatch(async x => x + 1, errProp)(1) instanceof Promise)
      ase(await tryCatch(async x => x + 1, errProp)(1), 2)
      aok(tryCatch(asyncThrowError, errProp)(1) instanceof Promise)
      const e1 = await tryCatch(asyncThrowError, errProp)(1)
      aok(e1 instanceof Error)
      ase(e1.name, 'Error')
      ase(e1.message, '1')
      ase(e1.x, 1)
      aok(tryCatch(reject, errProp)(1) instanceof Promise)
      const e2 = await tryCatch(reject, errProp)(1)
      aok(e2 instanceof Error)
      ase(e2.name, 'Error')
      ase(e2.message, '1')
      ase(e2.x, 1)
    })
    it('tries a sync function and catches with an async function', async () => {
      const asyncErrProp = async (err, x) => { err.x = x; return err }
      const throwError = x => { throw new Error(x) }
      ase(tryCatch(x => x + 1, asyncErrProp)(1), 2)
      aok(tryCatch(throwError, asyncErrProp)(1) instanceof Promise)
      const e1 = await tryCatch(throwError, asyncErrProp)(1)
      aok(e1 instanceof Error)
      ase(e1.name, 'Error')
      ase(e1.message, '1')
      ase(e1.x, 1)
    })
    it('tries an async function and catches with an async function', async () => {
      const asyncErrProp = async (err, x) => { err.x = x; return err }
      const asyncThrowError = async x => { throw new Error(x) }
      const reject = x => Promise.reject(new Error(x))
      aok(tryCatch(async x => x + 1, asyncErrProp)(1) instanceof Promise)
      ase(await tryCatch(async x => x + 1, asyncErrProp)(1), 2)
      aok(tryCatch(asyncThrowError, asyncErrProp)(1) instanceof Promise)
      const e1 = await tryCatch(asyncThrowError, asyncErrProp)(1)
      aok(e1 instanceof Error)
      ase(e1.name, 'Error')
      ase(e1.message, '1')
      ase(e1.x, 1)
      aok(tryCatch(reject, asyncErrProp)(1) instanceof Promise)
      const e2 = await tryCatch(reject, asyncErrProp)(1)
      aok(e2 instanceof Error)
      ase(e2.name, 'Error')
      ase(e2.message, '1')
      ase(e2.x, 1)
    })
    it('throws a TypeError if passed a non function tryer', async () => {
      assert.deepEqual(
        tryCatch('hey', (...args) => args)('sup'),
        [new TypeError('tryer is not a function'), 'sup'],
      )
    })
    it('won\'t enforce the catcher function typecheck', async () => {
      assert.deepEqual(
        tryCatch(() => 'ayo', Buffer.from('abc'))('hey'),
        'ayo',
      )
    })
  })

  describe('switchCase', () => {
    it('switches on provided sync functions', async () => {
      ase(
        switchCase([
          x => x === 1, () => 'hi',
          x => x === 2, () => 'ho',
          () => 'hey',
        ])(1),
        'hi',
      )
      ase(
        switchCase([
          x => x === 1, () => 'hi',
          x => x === 2, () => 'ho',
          () => 'hey',
        ])(2),
        'ho',
      )
      ase(
        switchCase([
          x => x === 1, () => 'hi',
          x => x === 2, () => 'ho',
          () => 'hey',
        ])(3),
        'hey',
      )
      ase(
        switchCase([
          x => x === 1, async () => 'hi',
          x => x === 2, async () => 'ho',
          () => 'hey',
        ])(3),
        'hey',
      )
    })
    it('switches on provided async functions', async () => {
      aok(
        switchCase([
          async x => x === 1, async () => 'hi',
          async x => x === 2, async () => 'ho',
          async () => 'hey',
        ])(1) instanceof Promise,
      )
      aok(
        switchCase([
          async x => x === 1, () => 'hi',
          x => x === 2, () => 'ho',
          () => 'hey',
        ])(1) instanceof Promise,
      )
      ase(
        await switchCase([
          async x => x === 1, async () => 'hi',
          async x => x === 2, async () => 'ho',
          async () => 'hey',
        ])(1),
        'hi',
      )
      ase(
        await switchCase([
          async x => x === 1, async () => 'hi',
          async x => x === 2, async () => 'ho',
          async () => 'hey',
        ])(2),
        'ho',
      )
      ase(
        await switchCase([
          async x => x === 1, async () => 'hi',
          async x => x === 2, async () => 'ho',
          async () => 'hey',
        ])(3),
        'hey',
      )
    })
    it('acts as identity for a single case', async () => {
      assert.throws(
        () => switchCase([])(),
        new TypeError('funcs[funcsIndex] is not a function'),
      )
    })
    it('acts as identity for a single case', async () => {
      assert.strictEqual(switchCase([() => false])(), false)
    })
    it('first function must always return true for only two cases', async () => {
      assert.strictEqual(switchCase([() => true, () => 'hey'])(), 'hey')
      assert.throws(
        () => switchCase([() => false, () => 'hey'])(),
        new TypeError('funcs[funcsIndex] is not a function'),
      )
    })
    it('throws a TypeError if passed a non array', async () => {
      assert.throws(
        () => switchCase('hey')(),
        new TypeError('funcs[funcsIndex] is not a function'),
      )
    })
    it('does not throw if passed an even number of functions', async () => {
      assert.strictEqual(
        switchCase([() => false, () => 'hey', () => true, () => 'ho'])(),
        'ho',
      )
    })
    it('however, throws TypeError if even number of functions and all cases are false', async () => {
      assert.throws(
        () => switchCase([() => false, () => 'hey'])(),
        new TypeError('funcs[funcsIndex] is not a function'),
      )
    })
    it('throws a TypeError if any item of the funcs array is not a function', async () => {
      assert.throws(
        () => switchCase([() => true, 'hey', () => true, () => 'ho', () => 'hi'])(),
        new TypeError('funcs[(funcsIndex + 1)] is not a function'),
      )
    })
  })

  describe('map', () => {
    describe('map(func A=>Promise|B)(Array<A>) -> Promise|Array<B>', () => {
      it('func A=>B; B', async () => {
        assert.deepEqual(
          map(num => num ** 2)([1, 2, 3, 4, 5]),
          [1, 4, 9, 16, 25],
        )
      })
      it('func A=>Promise<B>; Promise<B>', async () => {
        assert.deepEqual(
          await map(async num => num ** 2)([1, 2, 3, 4, 5]),
          [1, 4, 9, 16, 25],
        )
      })
    })

    describe('map(func A=>Promise|B)(Object<A>) -> Promise|Object<B>', () => {
      it('func A=>B; B', async () => {
        assert.deepEqual(
          map(num => num ** 2)({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
          { a: 1, b: 4, c: 9, d: 16, e: 25 },
        )
      })
      it('func A=>Promise<B>; Promise<B>', async () => {
        assert.deepEqual(
          await map(async num => num ** 2)({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
          { a: 1, b: 4, c: 9, d: 16, e: 25 },
        )
        assert.deepEqual(
          await map(
            num => num % 2 == 1 ? Promise.resolve(num ** 2) : num ** 2,
          )({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
          { a: 1, b: 4, c: 9, d: 16, e: 25 },
        )
      })
    })

    describe('map(func A=>B)(GeneratorFunction<A>) -> GeneratorFunction<B>', () => {
      it('func A=>B; B', async () => {
        const numbers = function* () { let i = 0; while (++i < 6) yield i }
        const squares = map(num => num ** 2)(numbers)
        assert.equal(objectToString(squares), '[object GeneratorFunction]')
        assert.deepEqual([...squares()], [1, 4, 9, 16, 25])
      })
    })

    describe('map(func A=>B)(Iterator<A>) -> Iterator<B>', () => {
      it('func A=>B; B', async () => {
        const numbers = function* () { let i = 0; while (++i < 6) yield i }
        const squaresIterator = map(num => num ** 2)(numbers())
        assert.equal(objectToString(squaresIterator), '[object Object]')
        assert.deepEqual([...squaresIterator], [1, 4, 9, 16, 25])
      })
    })

    describe('map(func A=>Promise|B)(AsyncGeneratorFunction<A>) -> AsyncGeneratorFunction<B>', () => {
      it('func A=>B; B', async () => {
        const asyncNumbers = async function* () { let i = 0; while (++i < 6) yield i }
        const asyncSquares = map(num => num ** 2)(asyncNumbers)
        assert.equal(objectToString(asyncSquares), '[object AsyncGeneratorFunction]')
        const squaresArray = []
        for await (const number of asyncSquares()) squaresArray.push(number)
        assert.deepEqual(squaresArray, [1, 4, 9, 16, 25])
      })
      it('func A=>Promise<B>; Promise<B>', async () => {
        const asyncNumbers = async function* () { let i = 0; while (++i < 6) yield i }
        const asyncSquares = map(async num => num ** 2)(asyncNumbers)
        assert.equal(objectToString(asyncSquares), '[object AsyncGeneratorFunction]')
        const squaresArray = []
        for await (const number of asyncSquares()) squaresArray.push(number)
        assert.deepEqual(squaresArray, [1, 4, 9, 16, 25])
      })
    })

    describe('map(func A=>Promise|B)(AsyncIterator<A>) -> AsyncIterator<B>', () => {
      it('func A=>B; AsyncIterator<B>', async () => {
        const asyncNumbers = async function* () { let i = 0; while (++i < 6) yield i }
        const asyncSquaresGenerator = map(num => num ** 2)(asyncNumbers())
        assert.equal(objectToString(asyncSquaresGenerator), '[object Object]')
        const squaresArray = []
        for await (const number of asyncSquaresGenerator) squaresArray.push(number)
        assert.deepEqual(squaresArray, [1, 4, 9, 16, 25])
      })
      it('func A=>Promise<B>; AsyncIterator<B>', async () => {
        const asyncNumbers = async function* () { let i = 0; while (++i < 6) yield i }
        const asyncSquaresGenerator = map(async num => num ** 2)(asyncNumbers())
        assert.equal(objectToString(asyncSquaresGenerator), '[object Object]')
        const squaresArray = []
        for await (const number of asyncSquaresGenerator) squaresArray.push(number)
        assert.deepEqual(squaresArray, [1, 4, 9, 16, 25])
      })
    })

    describe('map(func A=>Promise|B)(Reducer<A>) -> Reducer<B>', () => {
      it('func A=>B; Reducer<B>', async () => {
        const add = (a, b) => a + b
        assert.strictEqual(
          [1, 2, 3, 4, 5].reduce(map(num => num ** 2)(add), 0),
          55,
        )
      })
      it('func A=>B; async Reducer<A>; Reducer<B>', async () => {
        const asyncAdd = async (a, b) => a + b
        const asyncReducer = map(num => num ** 2)(asyncAdd)
        let total = 0
        for (const number of [1, 2, 3, 4, 5]) {
          total = await asyncReducer(total, number)
        }
        assert.strictEqual(total, 55)
      })
      it('func A=>Promise<B>; Reducer<B>', async () => {
        const add = (a, b) => a + b
        const asyncReducer = map(async num => num ** 2)(add)
        let total = 0
        for (const number of [1, 2, 3, 4, 5]) {
          total = await asyncReducer(total, number)
        }
        assert.strictEqual(total, 55)
      })
    })

    describe('map(func A=>B)(Mappable<A>) -> Mappable<B>', () => {
      it('func A=>B; B', async () => {
        const Mappable = function (value) {
          this.value = value
        }
        Mappable.prototype.map = function (func) {
          return new Mappable(func(this.value))
        }
        assert.deepEqual(
          map(value => value ** 2)(new Mappable(3)),
          new Mappable(9),
        )
      })
    })

    describe('map(func A=>Promise|B)(A) -> Promise|B', () => {
      it('func A=>B; B', async () => {
        assert.strictEqual(map(value => value)(1), 1)
      })
      it('func A=>Promise<B>; Promise<B>', async () => {
        assert.strictEqual(await map(async value => value)(1), 1)
      })
    })

    it('undefined; undefined', async () => {
      assert.strictEqual(map(value => value)(undefined), undefined)
    })

    it('null; null', async () => {
      assert.strictEqual(map(value => value)(null), null)
    })
  })

  describe('map.series', () => {
    describe('map.series(func A=>Promise|B)(Array<A>) -> Promise|Array<B>', () => {
      it('func A=>Promise<B>', async () => {
        const createNumbersPromises = () => [
          sleep(15).then(() => 1),
          sleep(10).then(() => 2),
          sleep(5).then(() => 3),
        ]
        {
          const arr = []
          await map(
            p => p.then(number => arr.push(number))
          )(createNumbersPromises())
          assert.deepEqual(arr, [3, 2, 1])
        }
        {
          const arr = []
          await map.series(
            p => p.then(number => arr.push(number))
          )(createNumbersPromises())
          assert.deepEqual(arr, [1, 2, 3])
        }
      })
      it('func A=>B', async () => {
        const square = number => number ** 2
        assert.deepEqual(
          map.series(square)([1, 2, 3, 4, 5]),
          [1, 4, 9, 16, 25],
        )
      })
    })
    it('syncly maps into array of functions', async () => {
      const arr = []
      ade(
        map.series(x => { arr.push(x); return x })([1, 2, 3]),
        [1, 2, 3],
      )
      ade(arr, [1, 2, 3])
    })
    it('throws TypeError for non functions', async () => {
      assert.throws(
        () => map.series('hey')([1]),
        new TypeError('mapper is not a function'),
      )
    })
    it('throws TypeError for non functions', async () => {
      assert.throws(
        () => map.series('hey')(),
        new TypeError('undefined is not an Array'),
      )
    })
    it('throws TypeError for non array input', async () => {
      assert.throws(
        () => map.series(() => 1)('hey'),
        new TypeError('hey is not an Array'),
      )
    })
  })

  describe('map.pool', () => {
    const asyncSquare = async x => x ** 2
    const possiblyAsyncSquare = x => x % 2 == 1 ? Promise.resolve(x ** 2) : x ** 2
    it('maps with asynchronous limit for Arrays', async () => {
      aok(map.pool(1, asyncSquare)([1, 2, 3, 4, 5]) instanceof Promise)
      ade(await map.pool(1, asyncSquare)([1, 2, 3, 4, 5]), [1, 4, 9, 16, 25])
      ade(await map.pool(9, asyncSquare)([1, 2, 3, 4, 5]), [1, 4, 9, 16, 25])
      ade(await map.pool(100, asyncSquare)([1, 2, 3, 4, 5]), [1, 4, 9, 16, 25])
      ade(await map.pool(1, asyncSquare)([1, 2, 3, 4, 5]), [1, 4, 9, 16, 25])
      ade(await map.pool(9, asyncSquare)([1, 2, 3, 4, 5]), [1, 4, 9, 16, 25])
    })
    it('alternating Promises', async () => {
      ade(await map.pool(1, possiblyAsyncSquare)([1, 2, 3, 4, 5]), [1, 4, 9, 16, 25])
      ade(await map.pool(9, possiblyAsyncSquare)([1, 2, 3, 4, 5]), [1, 4, 9, 16, 25])
    })
    it('=> [] for empty array', async () => {
      assert.deepEqual(map.pool(1, asyncSquare)([]), [])
    })
    it('works for arrays of undefined values', async () => {
      ade(await map.pool(1, x => x)([,,,,,]), Array(5).fill(undefined))
      ade(await map.pool(1, x => x)(Array(5)), Array(5).fill(undefined))
      ade(await map.pool(1, x => x)(Array(5).fill(null)), Array(5).fill(null))
    })
    xit('maps with asynchronous limit for Sets', async () => {
      const numbersSet = new Set([1, 2, 3, 4, 5])
      const squaresSet = new Set([1, 4, 9, 16, 25])
      aok(map.pool(1, asyncSquare)(numbersSet) instanceof Promise)
      ade(await map.pool(1, asyncSquare)(numbersSet), squaresSet)
      ade(await map.pool(9, asyncSquare)(numbersSet), squaresSet)
      ade(await map.pool(100, asyncSquare)(numbersSet), squaresSet)
      ade(await map.pool(1, asyncSquare)(numbersSet), squaresSet)
      ade(await map.pool(9, asyncSquare)(numbersSet), squaresSet)
    })
    xit('maps with asynchronous limit for Maps', async () => {
      const squareEntry = entry => entry.map(asyncSquare)
      const asyncSquareEntry = async entry => entry.map(asyncSquare)
      const numbersMap = new Map([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]])
      const squaresMap = new Map([[1, 1], [4, 4], [9, 9], [16, 16], [25, 25]])
      aok(map.pool(1, squareEntry)(numbersMap) instanceof Promise)
      ade(await map.pool(1, squareEntry)(numbersMap), squaresMap)
      ade(await map.pool(9, squareEntry)(numbersMap), squaresMap)
      ade(await map.pool(100, squareEntry)(numbersMap), squaresMap)
      ade(await map.pool(1, asyncSquareEntry)(numbersMap), squaresMap)
      ade(await map.pool(9, asyncSquareEntry)(numbersMap), squaresMap)
    })
    it('abides by asynchronous limit for arrays and sets', async () => {
      const numbers = [1, 2, 3, 4, 5, 6]
      let i = 0, maxi = 0, period = 10
      const plusSleepMinus = n => (async () => {
        i += 1
        maxi = Math.max(maxi, i)
      })().then(() => sleep(period)).then(() => {
        i -=1
        return n
      })
      ade(await map.pool(2, plusSleepMinus)(numbers), numbers)
      assert.strictEqual(maxi, 2)
      assert.strictEqual(i, 0)
      maxi = 0
      ade(await map.pool(3, plusSleepMinus)([1, 2, 3, 4, 5, 6]), numbers)
      assert.strictEqual(maxi, 3)
      assert.strictEqual(i, 0)
      maxi = 0
    }).timeout(20000)
    it('throws TypeError on map.pool(NaN)', async () => {
      assert.throws(
        () => map.pool(NaN)(NaN),
        new TypeError('NaN is not an Array'),
      )
    })
    it('throws TypeError on map.pool(lessThan1)', async () => {
      assert.throws(
        () => map.pool(1, () => {})('yo'),
        new TypeError('yo is not an Array'),
      )
    })
    it('handles sync errors good', async () => {
      assert.throws(
        () => map.pool(1, x => { throw new Error(`throwing ${x}`) })(['yo']),
        new Error('throwing yo')
      )
    })
    it('handles async errors good', async () => {
      assert.rejects(
        () => map.pool(1, async x => { throw new Error(`throwing ${x}`) })(['yo']),
        new Error('throwing yo'),
      )
    })
  })

  describe('map.withIndex', () => {
    it('[sync] applies a function to each item of array with index and reference to array', async () => {
      const numbers = [100, 100, 100, 100, 100]
      ade(
        map.withIndex((xi, i, x) => xi + i - x[i])(numbers),
        [0, 1, 2, 3, 4],
      )
    })
    it('[async] applies a function to each item of array with index and reference to array', async () => {
      const numbers = [100, 100, 100, 100, 100]
      aok(map.withIndex(async (xi, i, x) => xi + i - x[i])(numbers) instanceof Promise)
      ade(
        await map.withIndex(async (xi, i, x) => xi + i - x[i])(numbers),
        [0, 1, 2, 3, 4],
      )
    })
    xit('[sync] applies a function to each character of a string with index and value of string', async () => {
      ase(
        map.withIndex((xi, i, x) => xi + i + x[i])('abc'),
        'a0ab1bc2c',
      )
    })
    xit('[async] applies a function to each character of a string with index and value of string', async () => {
      aok(
        map.withIndex(async (xi, i, x) => xi + i + x[i])('abc') instanceof Promise
      )
      ase(
        await map.withIndex(async (xi, i, x) => xi + i + x[i])('abc'),
        'a0ab1bc2c',
      )
    })
    it('throws a TypeError on map.withIndex(nonFunction)', async () => {
      assert.throws(
        () => map.withIndex({})([1, 2, 3]),
        new TypeError('mapper is not a function'),
      )
    })
    it('throws a TypeError on map.withIndex(...)(null)', async () => {
      assert.throws(
        () => map.withIndex(() => 'hi')(null),
        new TypeError('null is not an Array')
      )
    })
  })

  describe('filter', () => {
    describe('filter(predicate T=>Promise|boolean)(Array<T>) -> Promise|Array<T>', () => {
      it('predicate T=>boolean', async () => {
        const isOdd = number => number % 2 == 1
        assert.deepEqual(
          filter(isOdd)([1, 2, 3, 4, 5]),
          [1, 3, 5],
        )
      })
      it('predicate T=>Promise<boolean>', async () => {
        const asyncIsOdd = async number => number % 2 == 1
        assert.deepEqual(
          await filter(asyncIsOdd)([1, 2, 3, 4, 5]),
          [1, 3, 5],
        )
      })
      it('predicate T=>Promise|boolean', async () => {
        const variadicAsyncIsOdd = number => number % 2 == 1 ? Promise.resolve(true) : false
        assert.deepEqual(
          await filter(variadicAsyncIsOdd)([1, 2, 3, 4, 5]),
          [1, 3, 5],
        )
        assert.deepEqual(
          await filter(variadicAsyncIsOdd)([2, 3, 4, 5, 6]),
          [3, 5],
        )
      })
      it('does not provide index or reference to original array', async () => {
        let total = 0
        filter((...args) => args.forEach(arg => (total += arg)))([1, 2, 3])
        assert.equal(total, 6)
      })
    })
    describe('filter(predicate T=>Promise|boolean)(Object<T>) -> Promise|Object<T>', () => {
      it('predicate T=>boolean', async () => {
        const isOdd = number => number % 2 == 1
        assert.deepEqual(
          filter(isOdd)({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
          { a: 1, c: 3, e: 5 },
        )
      })
      it('predicate T=>Promise<boolean>', async () => {
        const asyncIsOdd = async number => number % 2 == 1
        assert.deepEqual(
          await filter(asyncIsOdd)({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
          { a: 1, c: 3, e: 5 },
        )
      })
      it('predicate T=>Promise|boolean', async () => {
        const variadicAsyncIsOdd = number => number % 2 == 1 ? Promise.resolve(true) : false
        assert.deepEqual(
          await filter(variadicAsyncIsOdd)({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
          { a: 1, c: 3, e: 5 },
        )
        assert.deepEqual(
          await filter(variadicAsyncIsOdd)({ b: 2, c: 3, d: 4, e: 5, f: 6 }),
          { c: 3, e: 5 },
        )
      })
    })
    describe('filter(predicate T=>boolean)(GeneratorFunction<args, T>) -> GeneratorFunction<args, T>', () => {
      it('predicate T=>boolean', async () => {
        const numbers = function* () { let i = 0; while (++i < 6) yield i }
        const isOdd = number => number % 2 == 1
        const oddNumbers = filter(isOdd)(numbers)
        assert.equal(objectToString(oddNumbers), '[object GeneratorFunction]')
        assert.deepEqual([...oddNumbers()], [1, 3, 5])
      })
    })
    describe('filter(predicate T=>boolean)(Iterator<T>) -> Iterator<T>', () => {
      it('predicate T=>boolean', async () => {
        const numbers = function* () { let i = 0; while (++i < 6) yield i }
        const isOdd = number => number % 2 == 1
        const oddNumbersIterator = filter(isOdd)(numbers())
        assert.equal(objectToString(oddNumbersIterator), '[object Object]')
        assert.deepEqual([...oddNumbersIterator], [1, 3, 5])
      })
    })
    describe('filter(predicate T=>Promise|boolean)(AsyncGeneratorFunction<args, T>) -> AsyncGeneratorFunction<args, T>', () => {
      const asyncNumbers = async function* () { let i = 0; while (++i < 6) yield i }
      it('predicate T=>boolean', async () => {
        const isOdd = number => number % 2 == 1
        const asyncOddNumbers = filter(isOdd)(asyncNumbers)
        assert.equal(objectToString(asyncOddNumbers), '[object AsyncGeneratorFunction]')
        const oddNumbersArray = []
        for await (const number of asyncOddNumbers()) oddNumbersArray.push(number)
        assert.deepEqual(oddNumbersArray, [1, 3, 5])
      })
      it('predicate T=>Promise<boolean>', async () => {
        const asyncIsOdd = async number => number % 2 == 1
        const asyncOddNumbers = filter(asyncIsOdd)(asyncNumbers)
        assert.equal(objectToString(asyncOddNumbers), '[object AsyncGeneratorFunction]')
        const oddNumbersArray = []
        for await (const number of asyncOddNumbers()) oddNumbersArray.push(number)
        assert.deepEqual(oddNumbersArray, [1, 3, 5])
      })
      it('predicate T=>Promise|boolean', async () => {
        const variadicAsyncIsOdd = number => number % 2 == 1 ? Promise.resolve(true) : false
        const asyncOddNumbers = filter(variadicAsyncIsOdd)(asyncNumbers)
        assert.equal(objectToString(asyncOddNumbers), '[object AsyncGeneratorFunction]')
        const oddNumbersArray = []
        for await (const number of asyncOddNumbers()) oddNumbersArray.push(number)
        assert.deepEqual(oddNumbersArray, [1, 3, 5])
      })
    })
    describe('filter(predicate T=>Promise|boolean)(AsyncIterator<T>) -> AsyncIterator<T>', () => {
      const asyncNumbers = async function* () { let i = 0; while (++i < 6) yield i }
      it('predicate T=>boolean', async () => {
        const isOdd = number => number % 2 == 1
        const asyncOddNumbersIterator = filter(isOdd)(asyncNumbers())
        assert.equal(objectToString(asyncOddNumbersIterator), '[object Object]')
        const oddNumbersArray = []
        for await (const number of asyncOddNumbersIterator) oddNumbersArray.push(number)
        assert.deepEqual(oddNumbersArray, [1, 3, 5])
      })
      it('predicate T=>Promise<boolean>', async () => {
        const asyncIsOdd = async number => number % 2 == 1
        const asyncOddNumbers = filter(asyncIsOdd)(asyncNumbers)
        assert.equal(objectToString(asyncOddNumbers), '[object AsyncGeneratorFunction]')
        const oddNumbersArray = []
        for await (const number of asyncOddNumbers()) oddNumbersArray.push(number)
        assert.deepEqual(oddNumbersArray, [1, 3, 5])
      })
      it('predicate T=>Promise|boolean', async () => {
        const variadicAsyncIsOdd = number => number % 2 == 1 ? Promise.resolve(true) : false
        const asyncOddNumbers = filter(variadicAsyncIsOdd)(asyncNumbers)
        assert.equal(objectToString(asyncOddNumbers), '[object AsyncGeneratorFunction]')
        const oddNumbersArray = []
        for await (const number of asyncOddNumbers()) oddNumbersArray.push(number)
        assert.deepEqual(oddNumbersArray, [1, 3, 5])
      })
    })
    describe('filter(predicate T=>Promise|boolean)(Reducer<T>) -> Reducer<T>', () => {
      const concat = (array, values) => array.concat(values)
      it('predicate T=>boolean', async () => {
        const isOdd = number => number % 2 == 1
        const concatOdds = filter(isOdd)(concat)
        assert.deepEqual([1, 2, 3, 4, 5].reduce(concatOdds, []), [1, 3, 5])
      })
      it('predicate T=>Promise<boolean>', async () => {
        const asyncIsOdd = async number => number % 2 == 1
        const concatOdds = filter(asyncIsOdd)(concat)
        let oddNumbers = []
        for (const number of [1, 2, 3, 4, 5]) {
          oddNumbers = await concatOdds(oddNumbers, number)
        }
        assert.deepEqual(oddNumbers, [1, 3, 5])
      })
      it('predicate T=>Promise|boolean', async () => {
        const variadicAsyncIsOdd = number => number % 2 == 1 ? Promise.resolve(true) : false
        const concatOdds = filter(variadicAsyncIsOdd)(concat)
        let oddNumbers = []
        for (const number of [1, 2, 3, 4, 5]) {
          oddNumbers = await concatOdds(oddNumbers, number)
        }
        assert.deepEqual(oddNumbers, [1, 3, 5])
      })
    })
    describe('filter(predicate T=>boolean)(Filterable<T>) -> Filterable<T>', () => {
      it('predicate T=>boolean', async () => {
        const isOdd = number => number % 2 == 1
        const Filterable = function (value) {
          this.value = value
        }
        Filterable.prototype.filter = function (func) {
          return new Filterable(this.value.filter(func))
        }
        assert.deepEqual(
          filter(isOdd)(new Filterable([1, 2, 3, 4, 5])),
          new Filterable([1, 3, 5]),
        )
      })
    })
    describe('filter(predicate T=>boolean)(null) -> null', () => {
      it('predicate T=>boolean', async () => {
        assert.strictEqual(filter(() => true)(null), null)
      })
    })
    describe('filter(predicate T=>boolean)(undefined) -> undefined', () => {
      it('predicate T=>boolean', async () => {
        assert.strictEqual(filter(() => true)(undefined), undefined)
      })
    })
  })

  describe('filter.withIndex', () => {
    describe('filter.withIndex(predicate T=>Promise|boolean)(value Array<T>) -> Array<T>', () => {
      it('predicate T=>boolean', async () => {
        const shellUniq = filter.withIndex(
          (item, index, array) => item !== array[index + 1])
        assert.deepEqual(
          shellUniq([1, 1, 1, 2, 2, 3, 3, 3, 4, 5, 5, 5]),
          [1, 2, 3, 4, 5])
      })
      it('predicate T=>Promise<boolean>', async () => {
        const asyncShellUniq = filter.withIndex(
          async (item, index, array) => item !== array[index + 1])
        assert.deepEqual(
          await asyncShellUniq([1, 1, 1, 2, 2, 3, 3, 3, 4, 5, 5, 5]),
          [1, 2, 3, 4, 5])
      })
      it('predicate T=>Promise|boolean', async () => {
        const variadicAsyncShellUniq = filter.withIndex(
          (item, index, array) =>
            item !== array[index + 1] ? Promise.resolve(true) : false)
        assert.deepEqual(
          await variadicAsyncShellUniq([1, 1, 1, 2, 2, 3, 3, 3, 4, 5, 5, 5]),
          [1, 2, 3, 4, 5])
        assert.deepEqual(
          await variadicAsyncShellUniq([2, 2, 3, 3, 3, 4, 5, 5, 5, 6]),
          [2, 3, 4, 5, 6])
      })
    })

    describe('filter.withIndex(predicate T=>Promise|boolean)(value !Array)', () => {
      it('value Object', async () => {
        assert.throws(
          () => filter.withIndex(() => true)({}),
          new TypeError('[object Object] is not an Array'),
        )
      })
      it('value string', async () => {
        assert.throws(
          () => filter.withIndex(() => true)('hey'),
          new TypeError('hey is not an Array'),
        )
      })
      it('value function', async () => {
        assert.throws(
          () => filter.withIndex(() => true)(() => false),
          new TypeError('() => false is not an Array'),
        )
      })
      it('value null', async () => {
        assert.throws(
          () => filter.withIndex(() => true)(null),
          new TypeError('null is not an Array'),
        )
      })
      it('value undefined', async () => {
        assert.throws(
          () => filter.withIndex(() => true)(undefined),
          new TypeError('undefined is not an Array'),
        )
      })
    })
  })

  describe('reduce', () => {
    describe(`
Reducer<T> (any, T)=>Promise|any

Reducible<T> {
  reduce: (reducer Reducer<T>, init any)=>(result any),
}

reduce(
  reducer Reducer,
  init undefined|function|any,
) -> ...any=>function|Promise|any

reduce(
  reducer Reducer<T>,
  init undefined
    |((collection, ...restArgs)=>Promise|any)
    |any,
)(
  collection Iterable<T>|Iterator<T>
    |AsyncIterable<T>|AsyncIterator<T>
    |Reducible<T>|Object<T>,
  restArgs ...any,
) -> Promise|any

reduce(
  reducer Reducer<T>,
  init undefined
    |((collectionFactory, ...restArgs)=>Promise|any)
    |any,
)(
  collectionFactory (...any=>Iterator<T>)
    |(...any=>AsyncIterator<T>)
    |Reducer<T>,
  restArgs ...any,
) -> reducingFunction ...any=>Promise|any
`, () => {
  describe('reducer (any, T)=>Promise|any', () => {
    const add = (a, b) => a + b
    const asyncAdd = async (a, b) => a + b
    const variadicAsyncAdd = (a, b) => b % 2 == 1 ? Promise.resolve(a + b) : a + b
    it('collection Array<number>', async () => {
      assert.strictEqual(
        reduce(add, 0)([1, 2, 3, 4, 5]), 15)
      assert.strictEqual(
        await reduce(asyncAdd, 0)([1, 2, 3, 4, 5]), 15)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)([1, 2, 3, 4, 5]), 15)
    })
    it('collection Array<>', async () => {
      assert.strictEqual(
        reduce(add, 0)([]), 0)
      assert.strictEqual(
        reduce(asyncAdd, 0)([]), 0)
      assert.strictEqual(
        reduce(variadicAsyncAdd, 0)([]), 0)
    })
    it('collection { chain: function }', async () => {
      const Max = function (number) {
        this.number = number
      }
      Max.prototype.chain = function (flatMapper) {
        const monad = flatMapper(this.number)
        if (monad.constructor == Max) {
          return new Max(monad.number > this.number ? monad.number : this.number)
        }
        return monad
      }
      assert.strictEqual(reduce(add, 0)(new Max(5)), 5)
      assert.strictEqual(await reduce(asyncAdd, 0)(new Max(5)), 5)
      assert.strictEqual(await reduce(variadicAsyncAdd, 0)(new Max(5)), 5)
    })
    it('collection { flatMap: function }', async () => {
      const Max = function (number) {
        this.number = number
      }
      Max.prototype.flatMap = function (flatMapper) {
        const monad = flatMapper(this.number)
        if (monad.constructor == Max) {
          return new Max(monad.number > this.number ? monad.number : this.number)
        }
        return monad
      }
      assert.strictEqual(reduce(add, 0)(new Max(5)), 5)
      assert.strictEqual(await reduce(asyncAdd, 0)(new Max(5)), 5)
      assert.strictEqual(await reduce(variadicAsyncAdd, 0)(new Max(5)), 5)
    })
    it('collection Generator<number>', async () => {
      const numbers = function* () { yield 1; yield 2; yield 3; yield 4; yield 5 }
      assert.strictEqual(
        reduce(add, 0)(numbers()), 15)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers()), 15)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers()), 15)
    })
    it('collection Generator<>', async () => {
      const numbers = function* () {}
      assert.strictEqual(
        reduce(add, 0)(numbers()), 0)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers()), 0)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers()), 0)
    })
    it('collection ()=>Generator<number>', async () => {
      const numbers = function* () { yield 1; yield 2; yield 3; yield 4; yield 5 }
      assert.strictEqual(
        reduce(add, 0)(numbers)(), 15)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers)(), 15)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers)(), 15)
    })
    it('collection ()=>Generator<>', async () => {
      const numbers = function* () {}
      assert.strictEqual(
        reduce(add, 0)(numbers)(), 0)
      assert.strictEqual(
        reduce(asyncAdd, 0)(numbers)(), 0)
      assert.strictEqual(
        reduce(variadicAsyncAdd, 0)(numbers)(), 0)
    })
    it('collection AsyncGenerator<number>', async () => {
      const numbers = async function* () { yield 1; yield 2; yield 3; yield 4; yield 5 }
      assert.strictEqual(
        await reduce(add, 0)(numbers()), 15)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers()), 15)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers()), 15)
    })
    it('collection AsyncGenerator<>', async () => {
      const numbers = async function* () {}
      assert.equal(typeof reduce(add, 0)(numbers()).then, 'function')
      assert.strictEqual(
        await reduce(add, 0)(numbers()), 0)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers()), 0)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers()), 0)
    })
    it('collection ()=>AsyncGenerator<number>', async () => {
      const numbers = async function* () { yield 1; yield 2; yield 3; yield 4; yield 5 }
      assert.strictEqual(
        await reduce(add, 0)(numbers)(), 15)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers)(), 15)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers)(), 15)
    })
    it('collection ()=>AsyncGenerator<>', async () => {
      const numbers = async function* () {}
      assert.strictEqual(
        await reduce(add, 0)(numbers)(), 0)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers)(), 0)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers)(), 0)
    })
    it('collection Reducible<number>', async () => {
      const reducible = {
        reduce(reducer, init) {
          return [1, 2, 3, 4, 5].reduce(reducer, init)
        },
      }
      assert.strictEqual(
        reduce(add, 0)(reducible), 15)
    })
    it('collection Object<number>', async () => {
      const numbers = { a: 1, b: 2, c: 3, d: 4, e: 5 }
      assert.strictEqual(
        reduce(add, 0)(numbers), 15)
      assert.strictEqual(
        reduce(add, () => 0)(numbers), 15)
      assert.strictEqual(
        reduce(add)(numbers), 15)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers), 15)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers), 15)
    })
    it('collection Object<>', async () => {
      const numbers = {}
      assert.strictEqual(
        reduce(add, 0)(numbers), 0)
      assert.strictEqual(
        reduce(add, () => 0)(numbers), 0)
      assert.strictEqual(
        await reduce(asyncAdd, 0)(numbers), 0)
      assert.strictEqual(
        await reduce(variadicAsyncAdd, 0)(numbers), 0)
    })
    it('collection Reducer<number>', async () => {
      const reducers = [
        (a, b) => a + b,
      ]
      const combinedReducingFunction = reduce(
        (reducingFunc, reducer) => reducingFunc(reducer),
        () => reduce(result => result, 0),
      )(reducers)
      assert.strictEqual(combinedReducingFunction.name, 'reducing')
      assert.strictEqual(combinedReducingFunction([1, 2, 3, 4, 5]), 15)
    })
    it('reduce meta concatenation', async () => {
      const reducers = [
        (state, action) => action.type == 'A' ? { ...state, A: true } : state,
        (state, action) => action.type == 'B' ? { ...state, B: true } : state,
        (state, action) => action.type == 'C' ? { ...state, C: true } : state,
      ]
      const combinedReducingFunction = reduce(
        (reducingFunc, reducer) => reducingFunc(reducer),
        () => reduce(result => result, () => ({})),
      )(reducers)
      assert.deepEqual(combinedReducingFunction([
        { type: 'A' }, { type: 'B' }, { type: 'C' },
      ]), { A: true, B: true, C: true })
      assert.deepEqual(combinedReducingFunction([
        { type: 'A' }, { type: 'B' },
      ]), { A: true, B: true })
      assert.deepEqual(combinedReducingFunction([
        { type: 'A' },
      ]), { A: true })
      assert.deepEqual(combinedReducingFunction([
      ]), {})
      assert.deepEqual(combinedReducingFunction([
        { type: 'A' }, { type: 'C' },
      ]), { A: true, C: true })
    })
    it('multiple reducers as arguments', async () => {
      const reducers = [
        (state, action) => action.type == 'A' ? { ...state, A: true } : state,
        (state, action) => action.type == 'B' ? { ...state, B: true } : state,
        (state, action) => action.type == 'C' ? { ...state, C: true } : state,
      ]
      const combinedReducingFunction = reduce(
        result => result, () => ({}),
      )(...reducers)
      assert.deepEqual(combinedReducingFunction([
        { type: 'A' }, { type: 'B' }, { type: 'C' },
      ]), { A: true, B: true, C: true })
      assert.deepEqual(combinedReducingFunction([
        { type: 'A' }, { type: 'B' },
      ]), { A: true, B: true })
      assert.deepEqual(combinedReducingFunction([
        { type: 'A' },
      ]), { A: true })
      assert.deepEqual(combinedReducingFunction([
      ]), {})
      assert.deepEqual(combinedReducingFunction([
        { type: 'A' }, { type: 'C' },
      ]), { A: true, C: true })
    })
    it('collection (<object>, object)=>Promise<object>', async () => {
      const reducers = [
        async (state, action) => action.type == 'A' ? { ...state, A: true } : state,
        async (state, action) => action.type == 'B' ? { ...state, B: true } : state,
        async (state, action) => action.type == 'C' ? { ...state, C: true } : state,
      ]
      const combinedReducingFunction = reduce(
        (reducingFunc, reducer) => reducingFunc(reducer),
        () => reduce(result => result, () => ({})),
      )(reducers)
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' }, { type: 'B' }, { type: 'C' },
      ]), { A: true, B: true, C: true })
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' }, { type: 'B' },
      ]), { A: true, B: true })
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' },
      ]), { A: true })
      assert.deepEqual(await combinedReducingFunction([
      ]), {})
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' }, { type: 'C' },
      ]), { A: true, C: true })
    })
    it('collection (<object>, object)=>Promise|object', async () => {
      const reducers = [
        (state, action) => action.type == 'A' ? { ...state, A: true } : state,
        async (state, action) => action.type == 'B' ? { ...state, B: true } : state,
        async (state, action) => action.type == 'C' ? { ...state, C: true } : state,
      ]
      const combinedReducingFunction = reduce(
        (reducingFunc, reducer) => reducingFunc(reducer),
        () => reduce(result => result, () => ({})),
      )(reducers)
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' }, { type: 'B' }, { type: 'C' },
      ]), { A: true, B: true, C: true })
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' }, { type: 'B' },
      ]), { A: true, B: true })
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' },
      ]), { A: true })
      assert.deepEqual(await combinedReducingFunction([
      ]), {})
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' }, { type: 'C' },
      ]), { A: true, C: true })
      assert(typeof combinedReducingFunction([
        { type: 'A' },
      ]).then == 'function')
      assert.deepEqual(await combinedReducingFunction([
        { type: 'A' },
      ]), { A: true })
      assert(typeof combinedReducingFunction([
        { type: 'B' },
      ]).then == 'function')
      assert.deepEqual(await combinedReducingFunction([
        { type: 'B' },
      ]), { B: true })
    })
    it('collection atomic', async () => {
      assert.strictEqual(
        reduce((a, b) => a + b, 0)(10),
        10,
      )
      assert.strictEqual(
        reduce(number => number)(10),
        10,
      )
      assert.strictEqual(
        reduce(number => number, 0)(10),
        0,
      )
    })
    it('collection null', async () => {
      assert.strictEqual(
        reduce(value => value, 'hey')(null),
        'hey',
      )
    })
    it('collection undefined', async () => {
      assert.strictEqual(
        reduce(value => value, () => 'hey')(undefined),
        'hey',
      )
      assert.strictEqual(
        await reduce(value => value, async () => 'hey')(undefined),
        'hey',
      )
      assert.strictEqual(
        reduce(value => value, 'hey')(),
        'hey',
      )
    })
  })
})
  })

  describe('reduce - v1.5.10 regression', () => {
    const iterables = [
      [1, 2, 3, 4, 5],
      { a: 1, b: 2, c: 3, d: 4, e: 5 },
      new Set([1, 2, 3, 4, 5]),
      {
        [Symbol.iterator]: function* () {
          for (let i = 1; i < 6; i++) yield i
        },
      },
    ]
    const makeAsyncIterables = () => [
      stream.Readable.from([1, 2, 3, 4, 5]),
      stream.Readable.from((async function* () {
        for (let i = 1; i < 6; i++) yield i
      })()),
      constructReadStream([1, 2, 3, 4, 5]),
      {
        [Symbol.asyncIterator]: async function* () {
          await sleep(1)
          for (let i = 1; i < 6; i++) yield i
        },
      },
    ]
    it('reduces any iterable with a sync reducer', async () => {
      for (const x of iterables) {
        ase(reduce((y, xi) => y + xi)(x), 15)
        ase(reduce((y, xi) => y + xi, 10)(x), 25)
      }
    })
    it('reduces any iterable with an async reducer', async () => {
      aok(asyncMult(1, 2) instanceof Promise)
      for (const x of iterables) {
        aok(reduce(asyncMult)(x) instanceof Promise)
        ase(await reduce(asyncMult)(x), 120)
        ase(await reduce(asyncMult, 10)(x), 1200)
      }
    })
    it('reduces any async iterable with a sync reducer', async () => {
      for (const x of makeAsyncIterables()) {
        ase(await reduce((y, xi) => Number(y) + Number(xi))(x), 15)
      }
      for (const x of makeAsyncIterables()) {
        ase(await reduce((y, xi) => Number(y) + Number(xi), 10)(x), 25)
      }
    })
    it('reduces any async iterable with an async reducer', async () => {
      aok(asyncMult(1, 2) instanceof Promise)
      for (const x of makeAsyncIterables()) {
        aok(reduce(asyncMult)(x) instanceof Promise)
      }
      for (const x of makeAsyncIterables()) {
        ase(await reduce(asyncMult)(x), 120)
      }
      for (const x of makeAsyncIterables()) {
        ase(await reduce(asyncMult, 10)(x), 1200)
      }
    })
    it('reduces an iterable with variadic sync/async reducer', async () => {
      ade(
        await reduce(
          (a, b) => b === 1 ? a + b : Promise.resolve(a + b),
          0,
        )([1, 2, 3, 4, 5]),
        15,
      )
    })
    it('initial value can be a function', async () => {
      ade(
        reduce((a, b) => a + b, () => 0)([1, 2, 3, 4, 5]),
        15,
      )
      const asyncNumbers = async function*() {
        for (let i = 1; i <= 5; i++) yield i
      }
      ade(
        await reduce((a, b) => a + b, () => 0)(asyncNumbers()),
        15,
      )
      ade(
        await reduce((a, b) => a + b, () => 0)({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
        15,
      )
    })
    it('initial value can be an async function', async () => {
      ade(
        await reduce((a, b) => a + b, async () => 0)([1, 2, 3, 4, 5]),
        15,
      )
      const asyncNumbers = async function*() {
        for (let i = 1; i <= 5; i++) yield i
      }
      ade(
        await reduce((a, b) => a + b, async () => 0)(asyncNumbers()),
        15,
      )
      ade(
        await reduce((a, b) => a + b, async () => 0)({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
        15,
      )
    })
    it('referential initial values are unsafe', async () => {
      const square = x => x ** 2
      const unsafeSquareAll = reduce((a, b) => { a.push(square(b)); return a }, [])
      ade(
        unsafeSquareAll([1, 2, 3]),
        [1, 4, 9],
      )
      ade(
        unsafeSquareAll([1, 2, 3]),
        [1, 4, 9, 1, 4, 9],
      )
      const safeSquareAll = reduce((a, b) => { a.push(square(b)); return a }, () => [])
      ade(
        safeSquareAll([1, 2, 3]),
        [1, 4, 9],
      )
      ade(
        safeSquareAll([1, 2, 3]),
        [1, 4, 9],
      )
    })
    it('=> [] for initial () => [] and input []', async () => {
      const square = x => x ** 2
      ade(
        reduce(map(square)((a, b) => (a.push(b), a)), () => [])([]),
        [],
      )
      const emptyAsyncIterator = (async function*(){})()
      ade(
        await reduce(map(square)((a, b) => (a.push(b), a)), () => [])(emptyAsyncIterator),
        [],
      )
    })
  })

  describe('integration: transducers from pipe, map, filter, reduce', () => {
    const concat = (y, xi) => y.concat(xi)
    const add = (y, xi) => y + xi
    it('reduce with sync transduced reducers', async () => {
      const squareOdds = pipe([
        filter(isOdd),
        map(x => x ** 2),
      ])
      ade(
        reduce(squareOdds(concat), [])([1, 2, 3, 4, 5]),
        [1, 9, 25],
      )
      ade(
        reduce(squareOdds((y, xi) => y.add(xi)), new Set())([1, 2, 3, 4, 5]),
        new Set([1, 9, 25]),
      )
      const appendAlphas = pipe([
        map(x => x + 'a'),
        map(x => x + 'b'),
        map(x => x + 'c'),
      ])
      ase(
        reduce(appendAlphas(add), '')('123'),
        '1abc2abc3abc',
      )
      ade(
        reduce(appendAlphas(concat), [])('123'),
        ['1abc', '2abc', '3abc'],
      )
    })
    it('reduce with an async transduced reducer', async () => {
      const hosWithHey = pipe([
        filter(async x => x === 'ho'),
        map(x => Promise.resolve(x + 'hey')),
      ])
      const hihos = { a: 'hi', b: 'ho', c: 'hi', d: 'ho', e: 'hi', f: 'ho' }
      aok(reduce(hosWithHey(add), '')(hihos) instanceof Promise),
      aok(reduce(hosWithHey(concat), [])(hihos) instanceof Promise),
      ase(
        await reduce(hosWithHey(add), '')(hihos),
        'hoheyhoheyhohey',
      )
      ade(
        await reduce(hosWithHey(concat), [])(hihos),
        ['hohey', 'hohey', 'hohey'],
      )
    })
  })

  describe('transform', () => {
    describe(`
transform(
  transducer function,
  init function|any,
)(...any) -> Promise|any

Reducer<T> = (any, T)=>Promise|any

Transducer = Reducer=>Reducer

Semigroup = Array|string|Set|TypedArray
  |{ concat: function }|{ write: function }|Object

transform(
  transducer Transducer,
  init ((collection, ...restArgs)=>Promise|Semigroup|any)
    |Semigroup
    |any,
)(
  collection Iterable|Iterator
    |AsyncIterable|AsyncIterator
    |{ reduce: function }|Object|any,
  restArgs ...any
) -> Semigroup Promise|any

transform(
  transducer Transducer,
  init (...args=>Promise|Semigroup|any)
    |Semigroup
    |any,
)(
  generatorFunction (...args=>Generator)|(...args=>AsyncGenerator),
) -> reducingFunction (args ...any)=>Promise|Semigroup|any

transform(
  transducer Transducer,
  init (...args=>Promise|Semigroup|any)
    |Semigroup
    |any,
)(
  anotherReducer Reducer, moreReducers ...Reducer
) -> chainedReducingFunction (args ...any)=>Promise|any
    `, () => {
      describe('collection x init', () => {
        const square = number => number ** 2
        it('init []|() => []', async () => {
          assert.deepEqual(
            transform(map(square), [])([1, 2, 3, 4, 5]),
            [1, 4, 9, 16, 25],
          )
          assert.deepEqual(
            transform(map(square), () => [])([1, 2, 3, 4, 5]),
            [1, 4, 9, 16, 25],
          )
          assert.deepEqual(
            await transform(map(square), async () => [])([1, 2, 3, 4, 5]),
            [1, 4, 9, 16, 25],
          )
          assert.deepEqual(
            transform(map(square), (array, ...rest) => array.concat(rest))(
              [1, 2, 3, 4, 5], 0, 0),
            [1, 2, 3, 4, 5, 0, 0, 1, 4, 9, 16, 25]
          )
          assert.deepEqual(
            transform(map(square), [])([1, 2, 3, 4, 5][Symbol.iterator]()),
            [1, 4, 9, 16, 25],
          )
          const duplicate = item => [item, item]
          assert.deepEqual(
            transform(map(duplicate), [])([1, 2, 3, 4, 5]),
            [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
          )
          assert.deepEqual(
            transform(map(duplicate), () => [])([1, 2, 3, 4, 5]),
            [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
          )
          assert.deepEqual(
            await transform(map(async number => duplicate(number)), async () => [])([1, 2, 3, 4, 5]),
            [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
          )
        })
        it("init ''|(()=>'')", async () => {
          assert.strictEqual(
            transform(map(square), '')([1, 2, 3, 4, 5]),
            '1491625',
          )
          assert.strictEqual(
            transform(map(square), () => '')([1, 2, 3, 4, 5]),
            '1491625',
          )
          assert.strictEqual(
            await transform(map(async number => number ** 2), async () => '')([1, 2, 3, 4, 5]),
            '1491625',
          )
        })
        it('init Set|()=>Set', async () => {
          assert.deepEqual(
            transform(map(square), new Set())([1, 2, 3, 4, 5]),
            new Set([1, 4, 9, 16, 25]),
          )
          assert.deepEqual(
            transform(map(square), () => new Set())([1, 2, 3, 4, 5]),
            new Set([1, 4, 9, 16, 25]),
          )
          assert.deepEqual(
            await transform(map(square), async () => new Set())([1, 2, 3, 4, 5]),
            new Set([1, 4, 9, 16, 25]),
          )
          const SetWithSquare = number => new Set([number, number ** 2])
          assert.deepEqual(
            transform(map(SetWithSquare), new Set())([1, 2, 3, 4, 5]),
            new Set([1, 2, 4, 3, 9, 4, 16, 5, 25]),
          )
          assert.deepEqual(
            transform(map(SetWithSquare), () => new Set())([1, 2, 3, 4, 5]),
            new Set([1, 2, 4, 3, 9, 4, 16, 5, 25]),
          )
          assert.deepEqual(
            await transform(map(async number => SetWithSquare(number)), async () => new Set())([1, 2, 3, 4, 5]),
            new Set([1, 2, 4, 3, 9, 4, 16, 5, 25]),
          )
        })
        it('init TypedArray|()=>TypedArray', async () => {
          for (const constructor of numberTypedArrayConstructors) {
            assert.deepEqual(
              transform(map(square), new constructor())([1, 2, 3, 4, 5]),
              new constructor([1, 4, 9, 16, 25])
            )
            assert.deepEqual(
              transform(map(square), () => new constructor())([1, 2, 3, 4, 5]),
              new constructor([1, 4, 9, 16, 25])
            )
            assert.deepEqual(
              await transform(map(async number => number ** 2), async () => new constructor())([1, 2, 3, 4, 5]),
              new constructor([1, 4, 9, 16, 25])
            )
            assert.deepEqual(
              transform(map(number => new constructor([number ** 2])), () => new constructor())([1, 2, 3, 4, 5]),
              new constructor([1, 4, 9, 16, 25])
            )
            assert.deepEqual(
              await transform(map(async number => new constructor([number ** 2])), async () => new constructor())([1, 2, 3, 4, 5]),
              new constructor([1, 4, 9, 16, 25])
            )
          }
          for (const constructor of bigIntTypedArrayConstructors) {
            assert.deepEqual(
              transform(map(number => number ** 2n), new constructor())([1n, 2n, 3n, 4n, 5n]),
              new constructor([1n, 4n, 9n, 16n, 25n])
            )
            assert.deepEqual(
              transform(map(number => number ** 2n), () => new constructor())([1n, 2n, 3n, 4n, 5n]),
              new constructor([1n, 4n, 9n, 16n, 25n])
            )
            assert.deepEqual(
              await transform(map(async number => number ** 2n), async () => new constructor())([1n, 2n, 3n, 4n, 5n]),
              new constructor([1n, 4n, 9n, 16n, 25n])
            )
            assert.deepEqual(
              transform(map(number => new constructor([number ** 2n])), () => new constructor())([1n, 2n, 3n, 4n, 5n]),
              new constructor([1n, 4n, 9n, 16n, 25n])
            )
            assert.deepEqual(
              await transform(map(async number => new constructor([number ** 2n])), async () => new constructor())([1n, 2n, 3n, 4n, 5n]),
              new constructor([1n, 4n, 9n, 16n, 25n])
            )
          }
        })
        it('init { concat: function }|()=>({ concat: function })', async () => {
          const Max = function (number) {
            this.number = number
          }
          Max.prototype.concat = function (otherMax) {
            return new Max(otherMax.constructor == Max
              ? Math.max(this.number, otherMax.number)
              : Math.max(this.number, otherMax))
          }
          assert.deepEqual(
            transform(map(number => number ** 2), new Max(-Infinity))([1, 2, 3, 4, 5]),
            new Max(25),
          )
          assert.deepEqual(
            transform(map(number => number ** 2), () => new Max(-Infinity))([1, 2, 3, 4, 5]),
            new Max(25),
          )
          assert.deepEqual(
            await transform(map(async number => number ** 2), async () => new Max(-Infinity))([1, 2, 3, 4, 5]),
            new Max(25),
          )
        })
        it('init { write: function }|()=>({ write: function })', async () => {
          assert.deepEqual(
            transform(map(number => number ** 2), new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([1, 4, 9, 16, 25]),
          )
          assert.deepEqual(
            transform(map(number => number ** 2), () => new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([1, 4, 9, 16, 25]),
          )
          assert.deepEqual(
            await transform(map(async number => number ** 2), async () => new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([1, 4, 9, 16, 25]),
          )
          const numberToSquaredReadable = number => binaryToReadableStream(Buffer.from([number ** 2]))
          assert.deepEqual(
            await transform(map(numberToSquaredReadable), new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([1, 4, 9, 16, 25].map(number => new Uint8Array([number]))),
          )
          const numberToNumberObjectReadable = number => arrayToObjectReadableStream([{ number }])
          assert.deepEqual(
            await transform(map(numberToNumberObjectReadable), new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([
              { number: 1 },
              { number: 2 },
              { number: 3 },
              { number: 4 },
              { number: 5 },
            ]),
          )
          const numberToDuplicateString = number => `${number}${number}`
          assert.deepEqual(
            await transform(map(numberToDuplicateString), new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable(['11', '22', '33', '44', '55']),
          )
          const numberToDuplicateUint8Array = number => new Uint8Array([number, number])
          assert.deepEqual(
            transform(map(numberToDuplicateUint8Array), new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([
              new Uint8Array([1, 1]),
              new Uint8Array([2, 2]),
              new Uint8Array([3, 3]),
              new Uint8Array([4, 4]),
              new Uint8Array([5, 5]),
            ]),
          )
          const numberToObjectNumber = number => ({ number })
          assert.deepEqual(
            transform(map(numberToObjectNumber), new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([
              { number: 1 },
              { number: 2 },
              { number: 3 },
              { number: 4 },
              { number: 5 },
            ]),
          )
          const toNull = () => null
          assert.deepEqual(
            transform(map(toNull), new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([null, null, null, null, null]),
          )
          const getEmptyReadable = () => binaryToReadableStream(Buffer.from([]))
          assert.deepEqual(
            await transform(map(getEmptyReadable), new MockWritable([]))([1, 2, 3, 4, 5]),
            new MockWritable([]),
          )
          assert.throws(
            () => transform(map(function () {
              throw new Error('hey')
            }), new MockWritable([]))([1, 2, 3, 4, 5]),
            new Error('hey'),
          )
        })
        it('init 3', async () => {
          assert.strictEqual(
            transform(map(square), 3)([1, 2, 3, 4, 5]),
            3,
          )
        })
        it('init null|undefined', async () => {
          assert.strictEqual(
            transform(map(square), null)([1, 2, 3, 4, 5]),
            null,
          )
          assert.strictEqual(
            transform(map(square), undefined)([1, 2, 3, 4, 5]),
            undefined,
          )
          assert.strictEqual(
            transform(map(square))([1, 2, 3, 4, 5]),
            undefined,
          )
        })
      })
    })
  })

  describe('transform - v1.5.11 regression', () => {
    const squareOdds = pipe([filter(isOdd), map(square)])
    const asyncEvens = filter(asyncIsEven)
    const bigNumbers = [1n, 2n, 3n, 4n, 5n]
    const squareOddsToString = pipe([
      filter(isOdd),
      map(pipe([square, x => `${x}`])),
    ])
    it('sync transforms iterable to null', async () => {
      let y = ''
      ase(transform(map(tap(x => { y += x })), null)([1, 2, 3, 4, 5]), null)
      ase(y, '12345')
    })
    it('async transforms iterable to null', async () => {
      let y = ''
      aok(transform(map(tap(async () => {})), null)([1, 2, 3, 4, 5]) instanceof Promise)
      ase(await transform(map(tap(async x => { y += x })), null)([1, 2, 3, 4, 5]), null)
      ase(y, '12345')
    })
    it('sync transforms iterable to array', async () => {
      ade(transform(squareOdds, [])([1, 2, 3, 4, 5]), [1, 9, 25])
    })
    it('async transforms iterable to array', async () => {
      aok(transform(asyncEvens, [99])([1, 2, 3, 4, 5]) instanceof Promise)
      ade(await transform(asyncEvens, [99])([1, 2, 3, 4, 5]), [99, 2, 4])
    })
    it('sync transforms iterable to string', async () => {
      ase(transform(squareOdds, '')([1, 2, 3, 4, 5]), '1925')
    })
    it('async transforms iterable to string', async () => {
      aok(transform(asyncEvens, '99')([1, 2, 3, 4, 5]) instanceof Promise)
      ase(await transform(asyncEvens, '99')([1, 2, 3, 4, 5]), '9924')
    })
    it('sync transforms iterable to set', async () => {
      ade(transform(squareOdds, new Set())([1, 2, 3, 4, 5]), new Set([1, 9, 25]))
    })
    it('async transforms iterable to set', async () => {
      aok(transform(asyncEvens, new Set([99]))([1, 2, 3, 4, 5]) instanceof Promise)
      ade(
        await transform(asyncEvens, new Set([99, 2]))([1, 2, 3, 4, 5]),
        new Set([99, 2, 4]),
      )
    })
    it('strings are converted to numbers', async () => {
      for (const constructor of numberTypedArrayConstructors) {
        ade(
          transform(squareOddsToString, new constructor(0))([1, 2, 3, 4, 5]),
          new constructor([1, 9, 25]),
        )
      }
    })
    it('coerces booleans to 0 and 1', async () => {
      for (const constructor of numberTypedArrayConstructors) {
        assert.deepEqual(
          transform(map(x => x), new constructor(0))([true, false, false]),
          new constructor([1, 0, 0])
        )
      }
      for (const constructor of bigIntTypedArrayConstructors) {
        assert.deepEqual(
          transform(map(x => x), new constructor(0))([true, false, false]),
          new constructor([1n, 0n, 0n])
        )
      }
    })
    it('async transforms iterable to number TypedArray', async () => {
      for (const constructor of numberTypedArrayConstructors) {
        const buffer99 = new constructor([9, 9])
        const buffer9924 = transform(asyncEvens, buffer99)([1, 2, 3, 4, 5])
        aok(buffer9924 instanceof Promise)
        ade(await buffer9924, new constructor([9, 9, 2, 4]))
      }
    })
    it('sync transforms iterable to a bigint TypedArray', async () => {
      const isBigOdd = x => (x % 2n === 1n)
      const bigSquare = x => x ** 2n
      const squareBigOdds = pipe([filter(isBigOdd), map(bigSquare)])
      for (const constructor of bigIntTypedArrayConstructors) {
        ade(
          transform(squareBigOdds, new constructor(0))(bigNumbers),
          new constructor([1n, 9n, 25n]),
        )
      }
    })
    it('async transforms iterable to a bigint TypedArray', async () => {
      const asyncIsBigEven = async x => (x % 2n === 0n)
      const asyncBigEvens = filter(asyncIsBigEven)
      for (const constructor of bigIntTypedArrayConstructors) {
        const buffer99 = new constructor([9n, 9n])
        const buffer9924 = transform(asyncBigEvens, buffer99)(bigNumbers)
        aok(buffer9924 instanceof Promise)
        ade(await buffer9924, new constructor([9n, 9n, 2n, 4n]))
      }
    })
    it('sync transforms iterable to writeable stream', async () => {
      const tmpWriter = fs.createWriteStream(path.join(__dirname, './tmp'))
      transform(squareOddsToString, tmpWriter)([1, 2, 3, 4, 5])
      ase(await consumeReadStreamPush(
        fs.createReadStream(path.join(__dirname, './tmp')),
      ), '1925')
      ase(await consumeReadStreamPull(
        fs.createReadStream(path.join(__dirname, './tmp')),
      ), '1925')
      await fs.promises.unlink('./tmp')
    })
    it('async transforms iterable to writeable stream', async () => {
      const asyncEvensToString = pipe([
        filter(asyncIsEven),
        map(x => `${x}`)
      ])
      const tmpWriter = fs.createWriteStream(path.join(__dirname, './tmp'))
      tmpWriter.write('99')
      const writeEvens = transform(asyncEvensToString, tmpWriter)([1, 2, 3, 4, 5])
      aok(writeEvens instanceof Promise)
      await writeEvens
      ase(await consumeReadStreamPush(
        fs.createReadStream(path.join(__dirname, './tmp')),
      ), '9924')
      ase(await consumeReadStreamPull(
        fs.createReadStream(path.join(__dirname, './tmp')),
      ), '9924')
      await fs.promises.unlink('./tmp')
    })
    it('sync transforms an iterable to an object', async () => {
      ade(
        transform(map(n => ({ [n]: n })), {})([1, 2, 3, 4, 5]),
        { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 },
      )
    })
    it('async transforms an iterable to an object', async () => {
      aok(
        transform(map(async n => [n, n]), {})([1, 2, 3, 4, 5]) instanceof Promise,
      )
      aok(
        transform(map(async n => ({ [n]: n })), {})([1, 2, 3, 4, 5]) instanceof Promise,
      )
      ade(
        await transform(map(async n => ({ [n]: n })), {})([1, 2, 3, 4, 5]),
        { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 },
      )
    })
    it('initial value can be a function', async () => {
      const square = x => x ** 2
      ade(
        transform(map(square), () => [])([1, 2, 3]),
        [1, 4, 9],
      )
    })
    it('initial value can be an async function', async () => {
      const square = x => x ** 2
      aok(
        transform(map(square), async () => [])([1, 2, 3]) instanceof Promise,
      )
      ade(
        await transform(map(square), async () => [])([1, 2, 3]),
        [1, 4, 9],
      )
    })
    it('referential initial values are unsafe', async () => {
      const square = x => x ** 2
      const unsafeSquareAllTransform = transform(map(square), [])
      ade(
        unsafeSquareAllTransform([1, 2, 3]),
        [1, 4, 9],
      )
      ade(
        unsafeSquareAllTransform([1, 2, 3]),
        [1, 4, 9, 1, 4, 9],
      )
      const safeSquareAllTransform = transform(map(square), () => [])
      ade(
        safeSquareAllTransform([1, 2, 3]),
        [1, 4, 9],
      )
      ade(
        safeSquareAllTransform([1, 2, 3]),
        [1, 4, 9],
      )
    })
    it('=> [] for initial () => [] and input []', async () => {
      const square = x => x ** 2
      ade(
        transform(map(square), () => [])([]),
        [],
      )
      const emptyAsyncIterator = (async function*(){})()
      ade(
        await transform(map(square), () => [])(emptyAsyncIterator),
        [],
      )
    })
  })

  describe('flatMap', () => {
    describe(`
DuplexStream = { read: function, write: function }

Monad = Array|String|Set
  |TypedArray|DuplexStream|Iterator|AsyncIterator
  |{ chain: function }|{ flatMap: function }|Object

Foldable = Iterable|AsyncIterable|{ reduce: function }

flatMap(
  flatMapper item=>Promise|Monad|Foldable|any,
)(value Monad<item any>) -> result Monad

flatMap(
  flatMapper item=>Promise|Monad|Foldable|any,
)(
  value (args ...any)=>Generator<item>,
) -> flatMappingGeneratorFunction ...args=>Generator

flatMap(
  flatMapper item=>Promise|Monad|Foldable|any,
)(
  value (args ...any)=>AsyncGenerator<item>,
) -> flatMappingAsyncGeneratorFunction ...args=>AsyncGenerator

Reducer<T> = (any, T)=>Promise|any

flatMap(
  flatMapper item=>Promise|Monad|Foldable|any,
)(value Reducer<item>) -> flatMappingReducer Reducer
    `, () => {
      const async = func => async function asyncFunc(...args) {
        return func(...args)
      }

      const numbersArray = [1, 2, 3, 4, 5]
      const numbersDuplicates = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
      const numbersObject = { a: 1, b: 2, c: 3, d: 4, e: 5 }
      const numbersUint8Array = new Uint8Array([1, 2, 3, 4, 5])
      const numbersUint8ArrayDuplicates = new Uint8Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      const numbersInt8Array = new Int8Array([1, 2, 3, 4, 5])
      const numbersInt8ArrayDuplicates = new Int8Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      const numbersUint16Array = new Uint16Array([1, 2, 3, 4, 5])
      const numbersUint16ArrayDuplicates = new Uint16Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      const numbersInt16Array = new Int16Array([1, 2, 3, 4, 5])
      const numbersInt16ArrayDuplicates = new Int16Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      const numbersUint32Array = new Uint32Array([1, 2, 3, 4, 5])
      const numbersUint32ArrayDuplicates = new Uint32Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      const numbersInt32Array = new Int32Array([1, 2, 3, 4, 5])
      const numbersInt32ArrayDuplicates = new Int32Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      const numbersFloat32Array = new Float32Array([1, 2, 3, 4, 5])
      const numbersFloat32ArrayDuplicates = new Float32Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      const numbersFloat64Array = new Float64Array([1, 2, 3, 4, 5])
      const numbersFloat64ArrayDuplicates = new Float64Array([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      const numbersBigUint64Array = new BigUint64Array([1n, 2n, 3n, 4n, 5n])
      const numbersBigUint64ArrayDuplicates = new BigUint64Array([1n, 1n, 2n, 2n, 3n, 3n, 4n, 4n, 5n, 5n])
      const numbersBigInt64Array = new BigInt64Array([1n, 2n, 3n, 4n, 5n])
      const numbersBigInt64ArrayDuplicates = new BigInt64Array([1n, 1n, 2n, 2n, 3n, 3n, 4n, 4n, 5n, 5n])
      const bigIntsArray = [1n, 2n, 3n, 4n, 5n]
      const bigIntsDuplicates = [1n, 1n, 2n, 2n, 3n, 3n, 4n, 4n, 5n, 5n]
      const numbersSet = new Set([1, 2, 3, 4, 5])
      const bigIntsSet = new Set([1n, 2n, 3n, 4n, 5n])
      const numbersSetWithAyo = new Set([1, 2, 3, 4, 5, 'ayo'])
      const alphabetString = 'abcde'
      const numbersDuplexStream = new MockDuplexStream([1, 2, 3, 4, 5])
      const numbersGeneratorFunction = function* () { for (let i = 1; i < 6; i++) yield i }
      const asyncNumbersGeneratorFunction = async function* () { for (let i = 1; i < 6; i++) yield i }

      const identity = value => value
      const duplicateArray = value => [value, value]
      const duplicateObject = value => ({ [value * 10]: value, [value * 100]: value })
      const duplicateObjectString = value => ({ [value]: value, [`${value}${value}`]: value })
      const duplicateObjectBigInt = value => ({ [value * 10n]: value, [value * 100n]: value })
      const nestedObject = value => ({ a: { a: value }, b: { b: value } })
      const duplicateString = value => `${value}${value}`
      const setWithAyo = value => new Set([value, 'ayo'])
      const duplicateUint8ClampedArray = value => new Uint8ClampedArray([value, value])
      const duplicateUint8Array = value => new Uint8Array([value, value])
      const duplicateArrayOfUint8Array = value => [new Uint8Array([value]), new Uint8Array([value])]
      const duplicateInt8Array = value => new Int8Array([value, value])
      const duplicateUint16Array = value => new Uint16Array([value, value])
      const duplicateInt16Array = value => new Int16Array([value, value])
      const duplicateUint32Array = value => new Uint32Array([value, value])
      const duplicateInt32Array = value => new Int32Array([value, value])
      const duplicateFloat32Array = value => new Float32Array([value, value])
      const duplicateFloat64Array = value => new Float64Array([value, value])
      const duplicateBigUint64Array = value => new BigUint64Array([value, value])
      const duplicateBigInt64Array = value => new BigInt64Array([value, value])
      const duplicateReadableStream = value => binaryToReadableStream(Buffer.from([value, value]))
      const duplicateBuffer = value => Buffer.from([value, value])
      const duplicateMockFoldable = value => new MockFoldable([value, value])
      const duplicateMockFoldableObjects = value => new MockFoldable([{ [value * 10]: value }, { [value * 100]: value }])

      const DuplicateArray = function (value) {
        this.value = value
      }
      DuplicateArray.prototype = {
        chain(flatMapper) {
          return flatMapper([this.value, this.value])
        },
      }
      DuplicateArray.of = value => new DuplicateArray(value)

      const DuplicateObject = function  (value) {
        this.value = value
      }
      DuplicateObject.prototype = {
        chain(flatMapper) {
          const value = this.value
          return flatMapper({ [value * 10]: value, [value * 100]: value })
        },
      }
      DuplicateObject.of = value => new DuplicateObject(value)

      const Identity = function (value) {
        this.value = value
      }
      Identity.prototype = {
        flatMap(flatMapper) {
          return flatMapper(this.value)
        },
      }
      Identity.of = value => new Identity(value)

      const assertions = [
        [numbersArray, () => null, [null, null, null, null, null]],
        [numbersArray, () => [null, null], [null, null, null, null, null, null, null, null, null, null]],
        [numbersArray, () => undefined, [undefined, undefined, undefined, undefined, undefined]],
        [numbersArray, identity, numbersArray],
        [numbersArray, duplicateArray, numbersDuplicates],
        [numbersArray, async(duplicateArray), numbersDuplicates],
        [numbersArray, DuplicateArray.of, numbersArray.map(duplicateArray)], // calling .chain is 1 flat
        [numbersArray, async(DuplicateArray.of), numbersArray.map(duplicateArray)],
        [numbersArray, Identity.of, numbersArray],
        [numbersArray, async(Identity.of), numbersArray],
        [numbersArray, duplicateMockFoldable, numbersDuplicates],
        [numbersArray, async(duplicateMockFoldable), numbersDuplicates],
        [numbersArray, duplicateObject, numbersDuplicates],
        [numbersArray, async(duplicateObject), numbersDuplicates],
        [numbersArray, duplicateString, ['1', '1', '2', '2', '3', '3', '4', '4', '5', '5']],
        [numbersArray, async(duplicateString), ['1', '1', '2', '2', '3', '3', '4', '4', '5', '5']],
        [numbersArray, setWithAyo, [1, 'ayo', 2, 'ayo', 3, 'ayo', 4, 'ayo', 5, 'ayo']],
        [numbersArray, async(setWithAyo), [1, 'ayo', 2, 'ayo', 3, 'ayo', 4, 'ayo', 5, 'ayo']],
        [numbersArray, duplicateUint8ClampedArray, numbersDuplicates],
        [numbersArray, async(duplicateUint8ClampedArray), numbersDuplicates],
        [numbersArray, duplicateUint8Array, numbersDuplicates],
        [numbersArray, async(duplicateUint8Array), numbersDuplicates],
        [numbersArray, duplicateInt8Array, numbersDuplicates],
        [numbersArray, async(duplicateInt8Array), numbersDuplicates],
        [numbersArray, duplicateUint16Array, numbersDuplicates],
        [numbersArray, async(duplicateUint16Array), numbersDuplicates],
        [numbersArray, duplicateInt16Array, numbersDuplicates],
        [numbersArray, async(duplicateInt16Array), numbersDuplicates],
        [numbersArray, duplicateUint32Array, numbersDuplicates],
        [numbersArray, async(duplicateUint32Array), numbersDuplicates],
        [numbersArray, duplicateInt32Array, numbersDuplicates],
        [numbersArray, async(duplicateInt32Array), numbersDuplicates],
        [numbersArray, duplicateFloat32Array, numbersDuplicates],
        [numbersArray, async(duplicateFloat32Array), numbersDuplicates],
        [numbersArray, duplicateFloat64Array, numbersDuplicates],
        [numbersArray, async(duplicateFloat64Array), numbersDuplicates],
        [numbersArray, duplicateReadableStream, numbersArray.map(duplicateBuffer)], // 1 flat removes the stream
        [numbersArray, async(duplicateReadableStream), numbersArray.map(duplicateBuffer)],
        [bigIntsArray, identity, bigIntsArray],
        [bigIntsArray, duplicateBigUint64Array, bigIntsDuplicates],
        [bigIntsArray, async(duplicateBigUint64Array), bigIntsDuplicates],
        [bigIntsArray, duplicateBigInt64Array, bigIntsDuplicates],
        [bigIntsArray, async(duplicateBigInt64Array), bigIntsDuplicates],

        [alphabetString, identity, alphabetString],
        [alphabetString, duplicateArray, 'aabbccddee'],
        [alphabetString, async(duplicateArray), 'aabbccddee'],
        [alphabetString, DuplicateArray.of, 'a,ab,bc,cd,de,e'], // calling .chain is 1 flat
        [alphabetString, async(DuplicateArray.of), 'a,ab,bc,cd,de,e'],
        [alphabetString, Identity.of, alphabetString],
        [alphabetString, async(Identity.of), alphabetString],
        [alphabetString, duplicateMockFoldable, 'aabbccddee'],
        [alphabetString, async(duplicateMockFoldable), 'aabbccddee'],
        [alphabetString, duplicateObjectString, 'aabbccddee'],
        [alphabetString, async(duplicateObjectString), 'aabbccddee'],
        [alphabetString, duplicateString, 'aabbccddee'],
        [alphabetString, async(duplicateString), 'aabbccddee'],
        [alphabetString, setWithAyo, 'aayobayocayodayoeayo'],
        [alphabetString, async(setWithAyo), 'aayobayocayodayoeayo'],

        [numbersSet, identity, numbersSet],
        [numbersSet, () => null, new Set([null])],
        [numbersSet, duplicateArray, numbersSet],
        [numbersSet, async(duplicateArray), numbersSet],
        [numbersSet, DuplicateArray.of, new Set([...numbersSet].map(duplicateArray))],
        [numbersSet, async(DuplicateArray.of), new Set([...numbersSet].map(duplicateArray))],
        [numbersSet, Identity.of, numbersSet],
        [numbersSet, async(Identity.of), numbersSet],
        [numbersSet, duplicateMockFoldable, numbersSet],
        [numbersSet, async(duplicateMockFoldable), numbersSet],
        [numbersSet, duplicateObject, numbersSet],
        [numbersSet, async(duplicateObject), numbersSet],
        [numbersSet, setWithAyo, new Set([1, 2, 3, 4, 5, 'ayo'])],
        [numbersSet, async(setWithAyo), new Set([1, 2, 3, 4, 5, 'ayo'])],
        [numbersSet, duplicateString, new Set(['1', '2', '3', '4', '5'])],
        [numbersSet, async(duplicateString), new Set(['1', '2', '3', '4', '5'])],
        [numbersSet, duplicateUint8Array, numbersSet],
        [numbersSet, async(duplicateUint8Array), numbersSet],
        [numbersSet, duplicateInt8Array, numbersSet],
        [numbersSet, async(duplicateInt8Array), numbersSet],
        [numbersSet, duplicateUint16Array, numbersSet],
        [numbersSet, async(duplicateUint16Array), numbersSet],
        [numbersSet, duplicateInt16Array, numbersSet],
        [numbersSet, async(duplicateInt16Array), numbersSet],
        [numbersSet, duplicateUint32Array, numbersSet],
        [numbersSet, async(duplicateUint32Array), numbersSet],
        [numbersSet, duplicateInt32Array, numbersSet],
        [numbersSet, async(duplicateInt32Array), numbersSet],
        [numbersSet, duplicateFloat32Array, numbersSet],
        [numbersSet, async(duplicateFloat32Array), numbersSet],
        [numbersSet, duplicateFloat64Array, numbersSet],
        [numbersSet, async(duplicateFloat64Array), numbersSet],
        [numbersSet, duplicateReadableStream, new Set(numbersArray.map(duplicateBuffer))],
        [numbersSet, async(duplicateReadableStream), new Set(numbersArray.map(duplicateBuffer))],

        [numbersUint8Array, identity, numbersUint8Array],
        [numbersUint8Array, number => [[number, number]], numbersUint8ArrayDuplicates],
        [numbersUint8Array, async(number => [[number, number]]), numbersUint8ArrayDuplicates],
        [numbersUint8Array, number => [new Uint8Array([number, number])], numbersUint8ArrayDuplicates], // binary cannot nest arrays
        [numbersUint8Array, async(number => [new Uint8Array([number, number])]), numbersUint8ArrayDuplicates],
        [numbersUint8Array, number => [new Uint8Array([number]), new Uint8Array([number])], numbersUint8ArrayDuplicates],
        [numbersUint8Array, duplicateArray, numbersUint8ArrayDuplicates],
        [numbersUint8Array, async(duplicateArray), numbersUint8ArrayDuplicates],
        [numbersUint8Array, DuplicateArray.of, numbersUint8ArrayDuplicates],
        [numbersUint8Array, async(DuplicateArray.of), numbersUint8ArrayDuplicates],
        [numbersUint8Array, Identity.of, numbersUint8Array],
        [numbersUint8Array, async(Identity.of), numbersUint8Array],
        [numbersUint8Array, duplicateMockFoldable, numbersUint8ArrayDuplicates],
        [numbersUint8Array, async(duplicateMockFoldable), numbersUint8ArrayDuplicates],
        [numbersUint8Array, duplicateObject, numbersUint8ArrayDuplicates],
        [numbersUint8Array, async(duplicateObject), numbersUint8ArrayDuplicates],
        [numbersUint8Array, duplicateUint8Array, numbersUint8ArrayDuplicates],
        [numbersUint8Array, async(duplicateUint8Array), numbersUint8ArrayDuplicates],
        [numbersInt8Array, duplicateArray, numbersInt8ArrayDuplicates],
        [numbersInt8Array, async(duplicateArray), numbersInt8ArrayDuplicates],
        [numbersInt8Array, DuplicateArray.of, numbersInt8ArrayDuplicates],
        [numbersInt8Array, async(DuplicateArray.of), numbersInt8ArrayDuplicates],
        [numbersInt8Array, Identity.of, numbersInt8Array],
        [numbersInt8Array, async(Identity.of), numbersInt8Array],
        [numbersInt8Array, duplicateMockFoldable, numbersInt8ArrayDuplicates],
        [numbersInt8Array, async(duplicateMockFoldable), numbersInt8ArrayDuplicates],
        [numbersInt8Array, duplicateObject, numbersInt8ArrayDuplicates],
        [numbersInt8Array, async(duplicateObject), numbersInt8ArrayDuplicates],
        [numbersInt8Array, duplicateInt8Array, numbersInt8ArrayDuplicates],
        [numbersInt8Array, async(duplicateInt8Array), numbersInt8ArrayDuplicates],
        [numbersUint16Array, duplicateArray, numbersUint16ArrayDuplicates],
        [numbersUint16Array, async(duplicateArray), numbersUint16ArrayDuplicates],
        [numbersUint16Array, DuplicateArray.of, numbersUint16ArrayDuplicates],
        [numbersUint16Array, async(DuplicateArray.of), numbersUint16ArrayDuplicates],
        [numbersUint16Array, Identity.of, numbersUint16Array],
        [numbersUint16Array, async(Identity.of), numbersUint16Array],
        [numbersUint16Array, duplicateMockFoldable, numbersUint16ArrayDuplicates],
        [numbersUint16Array, async(duplicateMockFoldable), numbersUint16ArrayDuplicates],
        [numbersUint16Array, duplicateObject, numbersUint16ArrayDuplicates],
        [numbersUint16Array, async(duplicateObject), numbersUint16ArrayDuplicates],
        [numbersUint16Array, duplicateUint16Array, numbersUint16ArrayDuplicates],
        [numbersUint16Array, async(duplicateUint16Array), numbersUint16ArrayDuplicates],
        [numbersInt16Array, duplicateArray, numbersInt16ArrayDuplicates],
        [numbersInt16Array, async(duplicateArray), numbersInt16ArrayDuplicates],
        [numbersInt16Array, DuplicateArray.of, numbersInt16ArrayDuplicates],
        [numbersInt16Array, async(DuplicateArray.of), numbersInt16ArrayDuplicates],
        [numbersInt16Array, Identity.of, numbersInt16Array],
        [numbersInt16Array, async(Identity.of), numbersInt16Array],
        [numbersInt16Array, duplicateMockFoldable, numbersInt16ArrayDuplicates],
        [numbersInt16Array, async(duplicateMockFoldable), numbersInt16ArrayDuplicates],
        [numbersInt16Array, duplicateObject, numbersInt16ArrayDuplicates],
        [numbersInt16Array, async(duplicateObject), numbersInt16ArrayDuplicates],
        [numbersInt16Array, duplicateInt16Array, numbersInt16ArrayDuplicates],
        [numbersInt16Array, async(duplicateInt16Array), numbersInt16ArrayDuplicates],
        [numbersUint32Array, duplicateArray, numbersUint32ArrayDuplicates],
        [numbersUint32Array, async(duplicateArray), numbersUint32ArrayDuplicates],
        [numbersUint32Array, DuplicateArray.of, numbersUint32ArrayDuplicates],
        [numbersUint32Array, async(DuplicateArray.of), numbersUint32ArrayDuplicates],
        [numbersUint32Array, Identity.of, numbersUint32Array],
        [numbersUint32Array, async(Identity.of), numbersUint32Array],
        [numbersUint32Array, duplicateMockFoldable, numbersUint32ArrayDuplicates],
        [numbersUint32Array, async(duplicateMockFoldable), numbersUint32ArrayDuplicates],
        [numbersUint32Array, duplicateObject, numbersUint32ArrayDuplicates],
        [numbersUint32Array, async(duplicateObject), numbersUint32ArrayDuplicates],
        [numbersUint32Array, duplicateUint32Array, numbersUint32ArrayDuplicates],
        [numbersUint32Array, async(duplicateUint32Array), numbersUint32ArrayDuplicates],
        [numbersInt32Array, duplicateArray, numbersInt32ArrayDuplicates],
        [numbersInt32Array, async(duplicateArray), numbersInt32ArrayDuplicates],
        [numbersInt32Array, DuplicateArray.of, numbersInt32ArrayDuplicates],
        [numbersInt32Array, async(DuplicateArray.of), numbersInt32ArrayDuplicates],
        [numbersInt32Array, Identity.of, numbersInt32Array],
        [numbersInt32Array, async(Identity.of), numbersInt32Array],
        [numbersInt32Array, duplicateMockFoldable, numbersInt32ArrayDuplicates],
        [numbersInt32Array, async(duplicateMockFoldable), numbersInt32ArrayDuplicates],
        [numbersInt32Array, duplicateObject, numbersInt32ArrayDuplicates],
        [numbersInt32Array, async(duplicateObject), numbersInt32ArrayDuplicates],
        [numbersInt32Array, duplicateInt32Array, numbersInt32ArrayDuplicates],
        [numbersInt32Array, async(duplicateInt32Array), numbersInt32ArrayDuplicates],
        [numbersFloat32Array, duplicateArray, numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, async(duplicateArray), numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, DuplicateArray.of, numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, async(DuplicateArray.of), numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, Identity.of, numbersFloat32Array],
        [numbersFloat32Array, async(Identity.of), numbersFloat32Array],
        [numbersFloat32Array, duplicateMockFoldable, numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, async(duplicateMockFoldable), numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, duplicateObject, numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, async(duplicateObject), numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, duplicateFloat32Array, numbersFloat32ArrayDuplicates],
        [numbersFloat32Array, async(duplicateFloat32Array), numbersFloat32ArrayDuplicates],
        [numbersFloat64Array, duplicateArray, numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, async(duplicateArray), numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, DuplicateArray.of, numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, async(DuplicateArray.of), numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, Identity.of, numbersFloat64Array],
        [numbersFloat64Array, async(Identity.of), numbersFloat64Array],
        [numbersFloat64Array, duplicateMockFoldable, numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, async(duplicateMockFoldable), numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, duplicateObject, numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, async(duplicateObject), numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, duplicateFloat64Array, numbersFloat64ArrayDuplicates],
        [numbersFloat64Array, async(duplicateFloat64Array), numbersFloat64ArrayDuplicates],
        [numbersBigUint64Array, duplicateArray, numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, async(duplicateArray), numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, DuplicateArray.of, numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, async(DuplicateArray.of), numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, Identity.of, numbersBigUint64Array],
        [numbersBigUint64Array, async(Identity.of), numbersBigUint64Array],
        [numbersBigUint64Array, duplicateMockFoldable, numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, async(duplicateMockFoldable), numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, duplicateObjectBigInt, numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, async(duplicateObjectBigInt), numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, duplicateBigUint64Array, numbersBigUint64ArrayDuplicates],
        [numbersBigUint64Array, async(duplicateBigUint64Array), numbersBigUint64ArrayDuplicates],
        [numbersBigInt64Array, duplicateArray, numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, async(duplicateArray), numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, DuplicateArray.of, numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, async(DuplicateArray.of), numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, Identity.of, numbersBigInt64Array],
        [numbersBigInt64Array, async(Identity.of), numbersBigInt64Array],
        [numbersBigInt64Array, duplicateMockFoldable, numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, async(duplicateMockFoldable), numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, duplicateObjectBigInt, numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, async(duplicateObjectBigInt), numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, duplicateBigInt64Array, numbersBigInt64ArrayDuplicates],
        [numbersBigInt64Array, async(duplicateBigInt64Array), numbersBigInt64ArrayDuplicates],
        [bigIntsSet, duplicateBigUint64Array, bigIntsSet],
        [bigIntsSet, async(duplicateBigUint64Array), bigIntsSet],
        [bigIntsSet, duplicateBigInt64Array, bigIntsSet],
        [bigIntsSet, async(duplicateBigInt64Array), bigIntsSet],

        [new MockDuplexStream(numbersArray), identity, Object.assign(new MockDuplexStream(numbersArray), { array: numbersArray })],
        [new MockDuplexStream(numbersArray), () => null, Object.assign(new MockDuplexStream(numbersArray), { array: [null, null, null, null, null] })],
        [new MockDuplexStream(numbersArray), duplicateArray, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateArray), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), DuplicateArray.of, Object.assign(new MockDuplexStream(numbersArray), { array: numbersArray.map(duplicateArray) })], // .chain is 1 flat
        [new MockDuplexStream(numbersArray), async(DuplicateArray.of), Object.assign(new MockDuplexStream(numbersArray), { array: numbersArray.map(duplicateArray) })],
        [new MockDuplexStream(numbersArray), Identity.of, Object.assign(new MockDuplexStream(numbersArray), { array: numbersArray })],
        [new MockDuplexStream(numbersArray), async(Identity.of), Object.assign(new MockDuplexStream(numbersArray), { array: numbersArray })],
        [new MockDuplexStream(numbersArray), duplicateMockFoldable, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateMockFoldable), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateObject, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateObject), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateString, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateString), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateReadableStream, Object.assign(new MockDuplexStream(numbersArray), { array: numbersArray.map(duplicateBuffer) })], // 1 flat to buf
        [new MockDuplexStream(numbersArray), async(duplicateReadableStream), Object.assign(new MockDuplexStream(numbersArray), { array: numbersArray.map(duplicateBuffer) })],
        [new MockDuplexStream(numbersArray), duplicateUint8ClampedArray, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateUint8ClampedArray), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateUint8Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateUint8Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateInt8Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateInt8Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateUint16Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateUint16Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateInt16Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateInt16Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateUint32Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateUint32Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateInt32Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateInt32Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateFloat32Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateFloat32Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), duplicateFloat64Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(numbersArray), async(duplicateFloat64Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(bigIntsArray), duplicateBigUint64Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(bigIntsArray), async(duplicateBigUint64Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })],
        [new MockDuplexStream(bigIntsArray), duplicateBigInt64Array, Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })], // 1 == 1n true
        [new MockDuplexStream(bigIntsArray), async(duplicateBigInt64Array), Object.assign(new MockDuplexStream(numbersArray), { array: numbersDuplicates })], // 1 == 1n true

        [numbersGeneratorFunction(), identity, numbersArray, function (expected, actual) {
          assert.deepEqual([...actual], expected)
        }],
        [numbersGeneratorFunction(), duplicateArray, numbersDuplicates, function (expected, actual) {
          assert.deepEqual([...actual], expected)
        }],
        [numbersGeneratorFunction(), async(duplicateArray), numbersArray.map(duplicateArray), async function (expected, actual) {
          assert.deepEqual(await Promise.all(actual), expected) // flatten will only see promises, so async does not get flattened
        }],
        [numbersGeneratorFunction(), DuplicateArray.of, numbersArray.map(duplicateArray), function (expected, actual) {
          assert.deepEqual([...actual], expected)
        }],
        [numbersGeneratorFunction(), async(DuplicateArray.of), numbersArray.map(DuplicateArray.of), async function (expected, actual) {
          assert.deepEqual(await Promise.all(actual), expected) // flatten will only see promises, so async does not get flattened
        }],
        [numbersGeneratorFunction(), Identity.of, numbersArray, function (expected, actual) {
          const actualArray = [...actual]
          assert.deepEqual(actualArray, expected)
        }],
        [numbersGeneratorFunction(), async(Identity.of), numbersArray.map(Identity.of), async function (expected, actual) {
          assert.deepEqual(await Promise.all(actual), expected) // flatten will only see promises, so async does not get flattened
        }],
        [numbersGeneratorFunction(), duplicateMockFoldable, numbersDuplicates, function (expected, actual) {
          assert.deepEqual([...actual], expected)
        }],
        [numbersGeneratorFunction(), async(duplicateMockFoldable), numbersArray.map(duplicateMockFoldable), async function (expected, actual) {
          assert.deepEqual(await Promise.all(actual), expected) // flatten will only see promises, so async does not get flattened
        }],
        [numbersGeneratorFunction(), duplicateObject, numbersDuplicates, function (expected, actual) {
          assert.deepEqual([...actual], expected)
        }],
        [numbersGeneratorFunction(), async(duplicateObject), numbersArray.map(duplicateObject), async function (expected, actual) {
          assert.deepEqual(await Promise.all(actual), expected) // flatten will only see promises, so async does not get flattened
        }],

        [asyncNumbersGeneratorFunction(), identity, numbersArray, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), duplicateArray, numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), async(duplicateArray), numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],

        [asyncNumbersGeneratorFunction(), DuplicateArray.of, numbersArray.map(duplicateArray), async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],

        [asyncNumbersGeneratorFunction(), async(DuplicateArray.of), numbersArray.map(duplicateArray), async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), duplicateMockFoldable, numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), async(duplicateMockFoldable), numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), duplicateObject, numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), async(duplicateObject), numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), duplicateString, numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), async(duplicateString), numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), duplicateBuffer, numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), async(duplicateBuffer), numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), duplicateUint8Array, numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), async(duplicateUint8Array), numbersDuplicates, async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), duplicateReadableStream, numbersArray.map(duplicateBuffer), async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],
        [asyncNumbersGeneratorFunction(), async(duplicateReadableStream), numbersArray.map(duplicateBuffer), async function (expected, actual) {
          const actualArray = []
          for await (const item of actual) actualArray.push(item)
          assert.deepEqual(actualArray, expected)
        }],

        [numbersObject, identity, {}],
        [numbersObject, async(identity), {}],
        [numbersObject, duplicateArray, {}],
        [numbersObject, async(duplicateArray), {}],
        [numbersObject, number => [{ [number]: number }, { [number]: number }], { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }],
        [numbersObject, number => null, {}],
        [numbersObject, number => [{ [number]: null }, { [number]: null }], { 1: null, 2: null, 3: null, 4: null, 5: null }],
        [numbersObject, duplicateObject, { 
          '10': 1, '100': 1, '20': 2, '200': 2, '30': 3, '300': 3, '40': 4, '400': 4, '50': 5, '500': 5,
        }],
        [numbersObject, async(duplicateObject), { 
          '10': 1, '100': 1, '20': 2, '200': 2, '30': 3, '300': 3, '40': 4, '400': 4, '50': 5, '500': 5,
        }],
        [numbersObject, duplicateReadableStream, { 0: 5, 1: 5 }],
        [numbersObject, async(duplicateReadableStream), { 0: 5, 1: 5 }],
        [numbersObject, duplicateObjectString, { 1: 1, 11: 1, 2: 2, 22: 2, 3: 3, 33: 3, 4: 4, 44: 4, 5: 5, 55: 5 }],
        [numbersObject, async(duplicateObjectString), { 1: 1, 11: 1, 2: 2, 22: 2, 3: 3, 33: 3, 4: 4, 44: 4, 5: 5, 55: 5 }],
        [numbersObject, duplicateMockFoldable, {}],
        [numbersObject, async(duplicateMockFoldable), {}],
        [numbersObject, duplicateMockFoldableObjects, { 10: 1, 100: 1, 20: 2, 200: 2, 30: 3, 300: 3, 40: 4, 400: 4, 50: 5, 500: 5 }],
        [numbersObject, async(duplicateMockFoldableObjects), { 10: 1, 100: 1, 20: 2, 200: 2, 30: 3, 300: 3, 40: 4, 400: 4, 50: 5, 500: 5 }],
        [numbersObject, DuplicateObject.of, { 10: 1, 100: 1, 20: 2, 200: 2, 30: 3, 300: 3, 40: 4, 400: 4, 50: 5, 500: 5 }],
        [numbersObject, async(DuplicateObject.of), { 10: 1, 100: 1, 20: 2, 200: 2, 30: 3, 300: 3, 40: 4, 400: 4, 50: 5, 500: 5 }],
        [numbersObject, Identity.of, {}],
        [numbersObject, async(Identity.of), {}],
        [{ a: { a: 1 }, b: { b: 2 }, c: { c: 3 }, d: { d: 4 }, e: { e: 5 } }, Identity.of, numbersObject],
        [{ a: { a: 1 }, b: { b: 2 }, c: { c: 3 }, d: { d: 4 }, e: { e: 5 } }, async(Identity.of), numbersObject],

        [{ chain: flatMapper => flatMapper('ayo') }, duplicateArray, ['ayo', 'ayo']],
        [{ chain: flatMapper => flatMapper('ayo') }, async(duplicateArray), ['ayo', 'ayo']],
        [DuplicateArray.of('ayo'), DuplicateArray.of, DuplicateArray.of(['ayo', 'ayo'])],
        [DuplicateArray.of('ayo'), async(DuplicateArray.of), DuplicateArray.of(['ayo', 'ayo'])],
        [Identity.of('ayo'), Identity.of, Identity.of('ayo')],
        [Identity.of('ayo'), async(Identity.of), Identity.of('ayo')],

      ]

      const arrayOfLast = (array, n = 1) => array.slice(array.length - n, array.length)

      assertions.forEach(function ([value, flatMapper, result, asserter = assert.deepEqual]) {
        it(`flatMap(${flatMapper.name})(${value.constructor.name}<${value}>) - ${result}`, async () => {
          await asserter(
            result,
            await flatMap(flatMapper)(value),
          )
        })
      })

      it('value undefined', async () => {
        assert.strictEqual(flatMap(() => 'hey')(undefined), undefined)
        assert.strictEqual(flatMap(() => 'hey')(), undefined)
      })
      it('value null', async () => {
        assert.strictEqual(flatMap(() => 'hey')(null), null)
      })

      it('value GeneratorFunction', async () => {
        const numbers = function* () { yield 1; yield 2; yield 3; yield 4; yield 5 }
        const duplicateNumbers = flatMap(duplicateArray)(numbers)
        assert.equal(objectToString(duplicateNumbers), '[object GeneratorFunction]')
        assert.deepEqual([...duplicateNumbers()], numbersDuplicates)
        assert.deepEqual([...flatMap(() => null)(numbers)()], [null, null, null, null, null])
        assert.deepEqual([...flatMap(() => [null, null])(numbers)()], [null, null, null, null, null, null, null, null, null, null])
        assert.deepEqual([...flatMap(DuplicateArray.of)(numbers)()], numbersArray.map(duplicateArray))
        assert.deepEqual([...flatMap(Identity.of)(numbers)()], [1, 2, 3, 4, 5])
        assert.deepEqual([...flatMap(duplicateMockFoldable)(numbers)()], numbersDuplicates)
        assert.deepEqual([...flatMap(duplicateArray)(numbers)()], numbersDuplicates)
        assert.deepEqual([...flatMap(duplicateObject)(numbers)()], numbersDuplicates)
        assert.deepEqual([...flatMap(duplicateUint8Array)(numbers)()], numbersDuplicates)
        assert.deepEqual([...flatMap(number => new Set([number]))(numbers)()], numbersArray)
        assert.deepEqual([...flatMap(() => 1)(numbers)()], [1, 1, 1, 1, 1])
      })
      it('value AsyncGeneratorFunction', async () => {
        const numbers = async function* () { yield 1; yield 2; yield 3; yield 4; yield 5 }
        const duplicateNumbers = flatMap(duplicateArray)(numbers)
        assert.equal(objectToString(duplicateNumbers), '[object AsyncGeneratorFunction]')
        assert.deepEqual(await asyncIteratorToArray(duplicateNumbers()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(() => null)(numbers)()), [null, null, null, null, null])
        assert.deepEqual(await asyncIteratorToArray(flatMap(() => [null, null])(numbers)()), [null, null, null, null, null, null, null, null, null, null])
        assert.deepEqual(await asyncIteratorToArray(flatMap(DuplicateArray.of)(numbers)()), numbersArray.map(duplicateArray))
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(DuplicateArray.of))(numbers)()), numbersArray.map(duplicateArray))
        assert.deepEqual(await asyncIteratorToArray(flatMap(Identity.of)(numbers)()), [1, 2, 3, 4, 5])
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(Identity.of))(numbers)()), [1, 2, 3, 4, 5])
        assert.deepEqual(await asyncIteratorToArray(flatMap(duplicateArray)(numbers)()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(duplicateArray))(numbers)()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(duplicateObject)(numbers)()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(duplicateObject))(numbers)()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(duplicateUint8Array)(numbers)()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(duplicateUint8Array))(numbers)()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(duplicateMockFoldable)(numbers)()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(duplicateMockFoldable))(numbers)()), numbersDuplicates)
        assert.deepEqual(await asyncIteratorToArray(flatMap(duplicateReadableStream)(numbers)()), numbersArray.map(duplicateBuffer))
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(duplicateReadableStream))(numbers)()), numbersArray.map(duplicateBuffer))
        assert.deepEqual(await asyncIteratorToArray(flatMap(number => new Set([number]))(numbers)()), numbersArray)
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(number => new Set([number])))(numbers)()), numbersArray)
        assert.deepEqual(await asyncIteratorToArray(flatMap(() => 1)(numbers)()), [1, 1, 1, 1, 1])
        assert.deepEqual(await asyncIteratorToArray(flatMap(async(() => 1))(numbers)()), [1, 1, 1, 1, 1])
      })

      it('value Reducer', async () => {
        const concat = (array, values) => array.concat(values)
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateArray)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(map(duplicateString)(concat), []), ['11', '22', '33', '44', '55'])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateString)(concat), []), ['1', '1', '2', '2', '3', '3', '4', '4', '5', '5'])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateObject)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateBuffer)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateUint8ClampedArray)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateUint8Array)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateInt8Array)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateUint16Array)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateInt16Array)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateUint32Array)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateInt32Array)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateFloat32Array)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateFloat64Array)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1n, 2n, 3n, 4n, 5n].reduce(flatMap(duplicateBigUint64Array)(concat), []), [1n, 1n, 2n, 2n, 3n, 3n, 4n, 4n, 5n, 5n])
        assert.deepEqual([1n, 2n, 3n, 4n, 5n].reduce(flatMap(duplicateBigInt64Array)(concat), []), [1n, 1n, 2n, 2n, 3n, 3n, 4n, 4n, 5n, 5n])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateBuffer)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(duplicateMockFoldable)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(DuplicateArray.of)(concat), []), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(Identity.of)(concat), []), [1, 2, 3, 4, 5])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(() => null)(concat), []), [null, null, null, null, null])
        assert.deepEqual([1, 2, 3, 4, 5].reduce(flatMap(() => [null, null])(concat), []), [null, null, null, null, null, null, null, null, null, null])
        assert.deepEqual(await reduce(flatMap(duplicateReadableStream)(concat), [])([1, 2, 3, 4, 5]), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual(await reduce(flatMap(async(duplicateReadableStream))(concat), [])([1, 2, 3, 4, 5]), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        assert.deepEqual(await reduce(flatMap(duplicateArrayOfUint8Array)(concat), [])([1, 2, 3, 4, 5]), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
      })

      it('value number', async () => {
        assert.deepEqual(flatMap(duplicateArray)(1), [1, 1])
      })
    })

    describe('FlatMappingAsyncIterator', () => {
      const asyncNumbers = async function* () {
        yield 1; yield 2; yield 3; yield 4; yield 5
      }
      const flatMappingAsyncIterator = flatMap(value => value)(asyncNumbers())
      it('[object FlatMappingAsyncIterator]', async () => {
        assert.strictEqual(flatMappingAsyncIterator.toString(), '[object FlatMappingAsyncIterator]')
      })
    })
  })

  describe('flatMap - v1.5.12 regression', () => {
    it('maps then flattens an array, async + parallel', async () => {
      const asyncPowers = async x => [x ** 2, x ** 3]
      aok(flatMap(asyncPowers)([1, 2, 3, 4, 5]) instanceof Promise)
      ade(
        await flatMap(asyncPowers)([1, 2, 3, 4, 5]),
        [1, 1, 4, 8, 9, 27, 16, 64, 25, 125],
      )
    })
    it('maps then flattens an array, sync', async () => {
      const powers = x => [x ** 2, x ** 3]
      ade(
        flatMap(powers)([1, 2, 3, 4, 5]),
        [1, 1, 4, 8, 9, 27, 16, 64, 25, 125],
      )
      ade(
        flatMap(powers)([1, 2, 3, 4, 5]),
        [1, 1, 4, 8, 9, 27, 16, 64, 25, 125],
      )
      ade(
        flatMap(x => new Set([x ** 2]))([1, 2, 3, 4, 5]),
        [1, 4, 9, 16, 25],
      )
      ade(
        flatMap(
          x => x,
        )(
          flatMap(x => new Map([[x, x ** 2]]))([1, 2, 3, 4, 5]),
        ),
        [1, 1, 2, 4, 3, 9, 4, 16, 5, 25],
      )
      ade(
        flatMap(x => x)([1, 2, [3, 4], 5]),
        [1, 2, 3, 4, 5],
      )
    })
    it('maps then flattens objects', async () => {
      const createObject = () => ({ a: 1, b: 2, c: 3 })
      ade(
        flatMap(x => x)(arrayOf(createObject, 3)),
        [1, 2, 3, 1, 2, 3, 1, 2, 3],
      )
    })
    it('maps then flattens a Set', async () => {
      const powers = x => [x ** 2, x ** 3]
      ade(
        flatMap(
          powers,
        )(new Set([1, 2, 3])),
        new Set([1, 4, 8, 9, 27]),
      )
      ade(
        flatMap(
          x => new Set(powers(x)),
        )(new Set([1, 2, 3])),
        new Set([1, 4, 8, 9, 27]),
      )
    })
    it('maps then flattens objects', async () => {
      ade(
        flatMap(x => ({ square: x ** 2, cube: x ** 3 }))(new Set([1, 2, 3])),
        new Set([1, 4, 8, 9, 27])
      )
    })
    it('[async] maps then flattens a Set', async () => {
      const powers = async x => [x ** 2, x ** 3]
      aok(
        flatMap(
          powers,
        )(new Set([1, 2, 3])) instanceof Promise
      )
      ade(
        await flatMap(
          powers,
        )(new Set([1, 2, 3])),
        new Set([1, 4, 8, 9, 27]),
      )
      aok(
        flatMap(
          x => powers(x).then(x => new Set(x))
        )(new Set([1, 2, 3])) instanceof Promise
      )
      ade(
        await flatMap(
          x => powers(x).then(x => new Set(x))
        )(new Set([1, 2, 3])),
        new Set([1, 4, 8, 9, 27]),
      )
    })
    it('maps then flattens a reducer function', async () => {
      const powers = x => [x ** 2, x ** 3]
      ade(
        transform(
          flatMap(powers),
          [],
        )([1, 2, 3]),
        [1, 1, 4, 8, 9, 27],
      )
    })
    it('[async] maps then flattens a reducer function', async () => {
      const powers = async x => [x ** 2, x ** 3]
      aok(
        transform(
          flatMap(powers),
          [],
        )([1, 2, 3]) instanceof Promise
      )
      ade(
        await transform(
          flatMap(powers),
          [],
        )([1, 2, 3]),
        [1, 1, 4, 8, 9, 27],
      )
    })
  })

  describe('get', () => {
    const aaaaa = { a: { a: { a: { a: { a: 1 } } } } }
    const nested = [[[[[1]]]]]
    it('accesses a property of an object by name', async () => {
      ase(get('a')({ a: 1 }), 1)
      ase(get('b')({ a: 1 }), undefined)
      ase(get('b', 0)({ a: 1 }), 0)
      ase(get(0)([1]), 1)
      ase(get(1)([1]), undefined)
      ase(get(1, 0)([1]), 0)
    })
    it('accesses a property by array[index]', async () => {
      ase(get('[0][0][0][0][0]')(nested), 1)
      ase(get('[0][0][0][0][0')(nested), 1)
      ase(get('0][0][0][0][0]')(nested), 1)
      ase(get('0][0][0][0][0')(nested), 1)
    })
    it('accesses a property of an object by dot notation', async () => {
      ase(get('a.a.a.a.a')(aaaaa), 1)
      ase(get('a.a.a.a.b')(aaaaa), undefined)
      ase(get('a.a.a.a.b', 0)(aaaaa), 0)
      ase(get('0.0.0.0.0')(nested), 1)
      ase(get('0.0.0.0.1')(nested), undefined)
      ase(get('0.0.0.0.1', 0)(nested), 0)
    })
    it('accesses a property of an object by array', async () => {
      ase(get(['a', 'a', 'a', 'a', 'a'])(aaaaa), 1)
      ase(get(['a', 'a', 'a', 'a', 'b'])(aaaaa), undefined)
      ase(get(['a', 'a', 'a', 'a', 'b'], 0)(aaaaa), 0)
      ase(get([0, 0, 0, 0, 0])(nested), 1)
      ase(get([0, 0, 0, 0, 1])(nested), undefined)
      ase(get([0, 0, 0, 0, 1], 0)(nested), 0)
      ase(get(['a', 0])({ a: [1] }), 1)
    })
    it('handles null and undefined initial value with default or undefined', async () => {
      ase(get('a')(null), undefined)
      ase(get('a', () => 'yo')(null), 'yo')
      ase(get('a', 'yo')(null), 'yo')
      ase(get('a', 'yo')(undefined), 'yo')
    })
    it('defaultValue can be a function', async () => {
      ase(get('a', obj => obj.b)({ b: 1 }), 1)
      ase(get('a', obj => obj.b)({}), undefined)
    })
    it('clears cache at size 500', async () => {
    })
  })

  describe('pick', () => {
    const abc = { a: 1, b: 2, c: 3 }
    it('picks properties off an object defined by array', async () => {
      ade(pick(['a'])(abc), { a: 1 })
      ade(pick(['a', 'd'])(abc), { a: 1 })
      ade(pick(['d'])(abc), {})
      ade(pick(['d'])(null), null)
      ade(pick(['d'])(undefined), undefined)
      ade(pick(['d'])(), undefined)
    })
  })

  describe('omit', () => {
    const abc = { a: 1, b: 2, c: 3 }
    it('omits properties from an object defined by array', async () => {
      ade(omit(['a'])(abc), { b: 2, c: 3 })
      ade(omit(['a', 'd'])(abc), { b: 2, c: 3 })
      ade(omit(['d'])(abc), { a: 1, b: 2, c: 3 })
      ase(omit(['d'])(null), null)
      ase(omit(['d'])(undefined), undefined)
      ase(omit(['d'])(), undefined)
    })
  })

  describe('any', () => {
    const numbers = [1, 2, 3, 4, 5]
    const numbersObject = { a: 1, b: 2, c: 3, d: 4, e: 5 }
    it('[sync] tests fn against all items of iterable, true if any evaluation is truthy', async () => {
      ase(any(x => x > 5)(numbers), false)
      ase(any(x => x > 0)(numbers), true)
      ase(any(x => x > 5)(new Set(numbers)), false)
      ase(any(x => x > 0)(new Set(numbers)), true)
      ase(any(x => x > 5)(numbersObject), false)
      ase(any(x => x > 0)(numbersObject), true)
    })
    it('[async] tests fn against all items of iterable, true if any evaluation is truthy', async () => {
      aok(any(async x => x > 5)(numbers) instanceof Promise)
      ase(await any(async x => x > 5)(numbers), false)
      ase(await any(async x => x > 0)(numbers), true)
      ase(await any(async x => x > 5)(new Set(numbers)), false)
      ase(await any(async x => x > 0)(new Set(numbers)), true)
      ase(await any(async x => x > 5)(numbersObject), false)
      ase(await any(async x => x > 0)(numbersObject), true)
    })
    it('tests a variadic async function', async () => {
      ase(
        await any(x => x < 2 ? Promise.resolve(false) : true)([1, 2, 3, 4, 5]),
        true,
      )
    })
    it('throws TypeError on non function setup', async () => {
      assert.throws(
        () => any('hey'),
        new TypeError('any(x); x is not a function'),
      )
    })
    it('throws TypeError if input not iterable or object', async () => {
      assert.throws(
        () => any(x => x)(1),
        new TypeError('any(...)(x); x invalid'),
      )
    })
  })

  describe('all', () => {
    const numbers = [1, 2, 3, 4, 5]
    const numbersObject = { a: 1, b: 2, c: 3, d: 4, e: 5 }
    it('syncly evaluates fn against all items in iterable, true if all evaluations are truthy', async () => {
      ase(all(x => x > 5)(numbers), false)
      ase(all(x => x > 0)(numbers), true)
      ase(all(x => x > 5)(new Set(numbers)), false)
      ase(all(x => x > 0)(new Set(numbers)), true)
      ase(all(x => x > 5)(numbersObject), false)
      ase(all(x => x > 0)(numbersObject), true)
    })
    it('asyncly evaluates fn against all items in iterable, true if all evaluations are truthy', async () => {
      aok(all(async x => x > 5)(numbers) instanceof Promise)
      ase(await all(async x => x > 5)(numbers), false)
      ase(await all(async x => x > 0)(numbers), true)
      ase(await all(async x => x > 5)(new Set(numbers)), false)
      ase(await all(async x => x > 0)(new Set(numbers)), true)
      ase(await all(async x => x > 5)(numbersObject), false)
      ase(await all(async x => x > 0)(numbersObject), true)
    })
    it('tests a variadic async function', async () => {
      ase(
        await all(x => x < 2 ? Promise.resolve(true) : false)([1, 2, 3, 4, 5]),
        false,
      )
    })
    it('throws TypeError on all(nonFunction)', async () => {
      assert.throws(
        () => all('hey'),
        new TypeError('all(x); x is not a function'),
      )
    })
    it('throws TypeError on all(...)(string)', async () => {
      assert.throws(
        () => all(x => x)(1),
        new TypeError('all(...)(x); x invalid'),
      )
    })
  })

  describe('and', () => {
    const isGreaterThan1 = x => x > 1
    it('sync tests input against provided array of functions, true if all evaluations are truthy', async () => {
      ase(and([isOdd, isGreaterThan1])(3), true)
      ase(and([isOdd, isGreaterThan1])(1), false)
    })
    it('async tests input against provided array of functions, true if all evaluations are truthy', async () => {
      aok(and([asyncIsEven, isGreaterThan1])(2) instanceof Promise)
      ase(await and([asyncIsEven, isGreaterThan1])(2), true)
      ase(await and([asyncIsEven, isGreaterThan1])(0), false)
    })
    it('throws a TypeError if passed a non array', async () => {
      assert.throws(
        () => and('hey'),
        new TypeError('and(x); x is not an array of functions'),
      )
    })
    it('throws a RangeError if passed less than one function', async () => {
      assert.throws(
        () => and([]),
        new RangeError('and(x); x is not an array of at least one function'),
      )
    })
    it('throws a TypeError if any item is not a function', async () => {
      assert.throws(
        () => and([() => false, 'hey', () => 'hi']),
        new TypeError('and(x); x[1] is not a function'),
      )
    })
  })

  describe('or', () => {
    const isGreaterThan1 = x => x > 1
    it('sync tests input against provided array of functions, true if any evaluations are truthy', async () => {
      ase(or([isOdd, isGreaterThan1])(3), true)
      ase(or([isOdd, isGreaterThan1])(0), false)
    })
    it('async tests input against provided array of functions, true if any evaluations are truthy', async () => {
      aok(or([asyncIsEven, isGreaterThan1])(2) instanceof Promise)
      ase(await or([asyncIsEven, isGreaterThan1])(2), true)
      ase(await or([asyncIsEven, isGreaterThan1])(1), false)
    })
    it('throws a TypeError if passed a non array', async () => {
      assert.throws(
        () => or('hey'),
        new TypeError('or(fns); fns is not an array of functions'),
      )
    })
    it('throws a RangeError if passed less than one function', async () => {
      assert.throws(
        () => or([]),
        new RangeError('or(fns); fns is not an array of at least one function'),
      )
    })
    it('throws a TypeError if any item is not a function', async () => {
      assert.throws(
        () => or([() => false, 'hey', () => 'hi']),
        new TypeError('or(fns); fns[1] is not a function'),
      )
    })
  })

  describe('not', () => {
    it('[sync] not(isOdd)(x) === !isOdd(x)', async () => {
      ase(not(isOdd)(2), true)
      ase(not(isOdd)(1), false)
    })
    it('[async] not(isEven)(x) === !(await isEven(x))', async () => {
      aok(not(asyncIsEven)(2) instanceof Promise)
      ase(await not(asyncIsEven)(2), false)
      ase(await not(asyncIsEven)(1), true)
    })
    it('throws TypeError on not(nonFunction)', async () => {
      assert.throws(
        () => not('hey'),
        new TypeError('not(x); x is not a function'),
      )
    })
  })

  describe('eq', () => {
    it('[sync] eq(f, g)(x) === (f(x) === g(x))', async () => {
      ase(eq(x => `${x}`, x => x)('hey'), true)
      ase(eq(x => `${x}`, x => x)(1), false)
    })
    it('[async] eq(f, g)(x) === (f(x) === g(x))', async () => {
      aok(eq(x => `${x}`, async x => x)('hey') instanceof Promise)
      ase(await eq(async x => `${x}`, async x => x)('hey'), true)
      ase(await eq(async x => `${x}`, async x => x)(1), false)
    })
    it('[sync] eq(f, value)(x) === (valueA === valueB)', async () => {
      ase(eq(() => 'hey', 'hey')('ayylmao'), true)
      ase(eq(() => 'hey', 'ho')('ayylmao'), false)
    })
    it('[async] eq(f, value)(x) === (valueA === valueB)', async () => {
      ase(await eq(async () => 'hey', 'hey')('ayylmao'), true)
      ase(await eq('hey', async () => 'ho')('ayylmao'), false)
    })
    it('[sync] eq(value, g)(x) === (valueA === valueB)', async () => {
      ase(eq('hey', () => 'hey')('ayylmao'), true)
      ase(eq('hey', () => 'ho')('ayylmao'), false)
    })
    it('[async] eq(value, g)(x) === (value === g(x))', async () => {
      aok(eq('hey', async x => x)('hey') instanceof Promise)
      ase(await eq('hey', async x => x)('hey'), true)
      ase(await eq('ho', async x => x)(1), false)
    })
    it('[sync] eq(valueA, valueB)(x) === (valueA === valueB)', async () => {
      ase(eq('hey', 'hey')('ayylmao'), true)
      ase(eq('hey', 'ho')('ayylmao'), false)
    })
    it('false for eq(string,)', async () => {
      assert.strictEqual(eq('hey',)(), false)
    })
    it('false for too many arguments', async () => {
      assert.strictEqual(eq('hey', () => {}, 'ho')(), false)
    })
  })

  describe('gt', () => {
    it('[sync] gt(f, g)(x) === (f(x) > g(x))', async () => {
      ase(gt(x => x + 1, x => x)(1), true)
      ase(gt(x => x, x => x)(1), false)
      ase(gt(x => x, x => x + 1)(1), false)
    })
    it('[async] gt(f, g)(x) === (f(x) > g(x))', async () => {
      aok(gt(x => x + 1, async x => x)(1) instanceof Promise)
      ase(await gt(x => x + 1, async x => x)(1), true)
      ase(await gt(async x => x, x => x)(1), false)
      ase(await gt(async x => x, async x => x + 1)(1), false)
    })
    it('[sync] gt(f, value)(x) === (valueA > valueB)', async () => {
      ase(gt(() => 1, 0)('ayylmao'), true)
      ase(gt(() => 1, 1)('ayylmao'), false)
      ase(gt(() => 0, 1)('ayylmao'), false)
    })
    it('[sync] gt(value, g)(x) === (valueA > valueB)', async () => {
      ase(gt(1, () => 0)('ayylmao'), true)
      ase(gt(1, () => 1)('ayylmao'), false)
      ase(gt(0, () => 1)('ayylmao'), false)
    })
    it('[async] gt(value, g)(x) === (value > g(x))', async () => {
      aok(gt(1, async x => x)(2) instanceof Promise)
      ase(await gt(1, async x => x)(0), true)
      ase(await gt(1, async x => x)(1), false)
      ase(await gt(1, async x => x)(2), false)
    })
    it('[sync] gt(valueA, valueB)(x) === (valueA > valueB)', async () => {
      ase(gt(1, 0)('ayylmao'), true)
      ase(gt(1, 1)('ayylmao'), false)
      ase(gt(0, 1)('ayylmao'), false)
    })
    it('throws RangeError on not enough arguments', async () => {
      assert.strictEqual(gt('hey')(), false)
    })
    it('throws RangeError on too many arguments', async () => {
      assert.strictEqual(gt('hey', () => {}, 'ho')(), false)
    })
  })

  describe('lt', () => {
    it('[sync] lt(f, g)(x) === (f(x) < g(x))', async () => {
      ase(lt(x => x + 1, x => x)(1), false)
      ase(lt(x => x, x => x)(1), false)
      ase(lt(x => x, x => x + 1)(1), true)
    })
    it('[async] lt(f, g)(x) === (f(x) < g(x))', async () => {
      aok(lt(x => x + 1, async x => x)(1) instanceof Promise)
      ase(await lt(x => x + 1, async x => x)(1), false)
      ase(await lt(async x => x, x => x)(1), false)
      ase(await lt(async x => x, async x => x + 1)(1), true)
    })
    it('[sync] lt(f, value)(x) === (valueA < valueB)', async () => {
      ase(lt(() => 1, 0)('ayylmao'), false)
      ase(lt(() => 1, 1)('ayylmao'), false)
      ase(lt(() => 0, 1)('ayylmao'), true)
    })
    it('[sync] lt(value, g)(x) === (valueA < valueB)', async () => {
      ase(lt(1, () => 0)('ayylmao'), false)
      ase(lt(1, () => 1)('ayylmao'), false)
      ase(lt(0, () => 1)('ayylmao'), true)
    })
    it('[async] lt(value, g)(x) === (value < g(x))', async () => {
      aok(lt(1, async x => x)(2) instanceof Promise)
      ase(await lt(1, async x => x)(0), false)
      ase(await lt(1, async x => x)(1), false)
      ase(await lt(1, async x => x)(2), true)
    })
    it('[sync] lt(valueA, valueB)(x) === (valueA < valueB)', async () => {
      ase(lt(1, 0)('ayylmao'), false)
      ase(lt(1, 1)('ayylmao'), false)
      ase(lt(0, 1)('ayylmao'), true)
    })
    it('throws RangeError on not enough arguments', async () => {
      assert.strictEqual(lt('hey')(), false)
    })
    it('throws RangeError on too many arguments', async () => {
      assert.strictEqual(lt('hey', () => {}, 'ho')(), false)
    })
  })

  describe('gte', () => {
    it('[sync] gte(f, g)(x) === (f(x) >= g(x))', async () => {
      ase(gte(x => x + 1, x => x)(1), true)
      ase(gte(x => x, x => x)(1), true)
      ase(gte(x => x, x => x + 1)(1), false)
    })
    it('[async] gte(f, g)(x) === (f(x) >= g(x))', async () => {
      aok(gte(x => x + 1, async x => x)(1) instanceof Promise)
      ase(await gte(x => x + 1, async x => x)(1), true)
      ase(await gte(async x => x, x => x)(1), true)
      ase(await gte(async x => x, async x => x + 1)(1), false)
    })
    it('[sync] gte(f, value)(x) === (valueA >= valueB)', async () => {
      ase(gte(() => 1, 0)('ayylmao'), true)
      ase(gte(() => 1, 1)('ayylmao'), true)
      ase(gte(() => 0, 1)('ayylmao'), false)
    })
    it('[sync] gte(value, g)(x) === (valueA >= valueB)', async () => {
      ase(gte(1, () => 0)('ayylmao'), true)
      ase(gte(1, () => 1)('ayylmao'), true)
      ase(gte(0, () => 1)('ayylmao'), false)
    })
    it('[async] gte(value, g)(x) === (value >= g(x))', async () => {
      aok(gte(1, async x => x)(2) instanceof Promise)
      ase(await gte(1, async x => x)(0), true)
      ase(await gte(1, async x => x)(1), true)
      ase(await gte(1, async x => x)(2), false)
    })
    it('[sync] gte(valueA, valueB)(x) === (valueA >= valueB)', async () => {
      ase(gte(1, 0)('ayylmao'), true)
      ase(gte(1, 1)('ayylmao'), true)
      ase(gte(0, 1)('ayylmao'), false)
    })
    it('throws RangeError on not enough arguments', async () => {
      assert.strictEqual(gte('hey')(), false)
    })
    it('throws RangeError on too many arguments', async () => {
      assert.strictEqual(gte('hey', () => {}, 'ho')(), false)
    })
  })

  describe('lte', () => {
    it('[sync] lte(f, g)(x) === (f(x) <= g(x))', async () => {
      ase(lte(x => x + 1, x => x)(1), false)
      ase(lte(x => x, x => x)(1), true)
      ase(lte(x => x, x => x + 1)(1), true)
    })
    it('[async] lte(f, g)(x) === (f(x) <= g(x))', async () => {
      aok(lte(x => x + 1, async x => x)(1) instanceof Promise)
      ase(await lte(x => x + 1, async x => x)(1), false)
      ase(await lte(async x => x, x => x)(1), true)
      ase(await lte(async x => x, async x => x + 1)(1), true)
    })
    it('[sync] lte(f, value)(x) === (valueA <= valueB)', async () => {
      ase(lte(() => 1, 0)('ayylmao'), false)
      ase(lte(() => 1, 1)('ayylmao'), true)
      ase(lte(() => 0, 1)('ayylmao'), true)
    })
    it('[sync] lte(value, g)(x) === (valueA <= valueB)', async () => {
      ase(lte(1, () => 0)('ayylmao'), false)
      ase(lte(1, () => 1)('ayylmao'), true)
      ase(lte(0, () => 1)('ayylmao'), true)
    })
    it('[async] lte(value, g)(x) === (value <= g(x))', async () => {
      aok(lte(1, async x => x)(2) instanceof Promise)
      ase(await lte(1, async x => x)(0), false)
      ase(await lte(1, async x => x)(1), true)
      ase(await lte(1, async x => x)(2), true)
    })
    it('[sync] lte(valueA, valueB)(x) === (valueA <= valueB)', async () => {
      ase(lte(1, 0)('ayylmao'), false)
      ase(lte(1, 1)('ayylmao'), true)
      ase(lte(0, 1)('ayylmao'), true)
    })
    it('throws RangeError on not enough arguments', async () => {
      assert.strictEqual(lte('hey')(), false)
    })
    it('throws RangeError on too many arguments', async () => {
      assert.strictEqual(lte('hey', () => {}, 'ho')(), false)
    })
  })

  it('exports 24 functions', async () => {
    ase(Object.keys(rubico).length, 24)
  })
})
