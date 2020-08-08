const assert = require('assert')
const Struct = require('./Struct')

describe('Struct', () => {
  describe('new Struct(x Array|Object|Set|Map) -> Struct', () => {
    it('x Array; Struct', async () => {
      assert.equal(new Struct([1, 2, 3]).constructor, Struct)
    })
    it('x Object; Struct', async () => {
      assert.equal(new Struct({ a: 1, b: 2, c: 3 }).constructor, Struct)
    })
    it('x Set; Struct', async () => {
      assert.equal(new Struct(new Set([1, 2, 3])).constructor, Struct)
    })
    it('x Map; Struct', async () => {
      assert.equal(new Struct(new Map([['a', 1], ['b', 2], ['c', 3]])).constructor, Struct)
    })
    it('x string; TypeError', async () => {
      assert.throws(
        () => new Struct('hey'),
        new TypeError('cannot convert hey to Struct')
      )
    })
    it('x null; TypeError', async () => {
      assert.throws(
        () => new Struct(null),
        new TypeError('cannot convert null to Struct')
      )
    })
    it('x undefined; TypeError', async () => {
      assert.throws(
        () => new Struct(undefined),
        new TypeError('cannot convert undefined to Struct')
      )
    })
  })

  describe('Struct.isStruct(x any) -> boolean', () => {
    it('x Array; true', async () => {
      assert.equal(Struct.isStruct([]), true)
    })
    it('x Object; true', async () => {
      assert.equal(Struct.isStruct({}), true)
    })
    it('x Set; true', async () => {
      assert.equal(Struct.isStruct(new Set()), true)
    })
    it('x Map; true', async () => {
      assert.equal(Struct.isStruct(new Map()), true)
    })
    it('x ArrayBuffer; false', async () => {
      assert.equal(Struct.isStruct(new ArrayBuffer()), false)
    })
    it('x Number; false', async () => {
      assert.equal(Struct.isStruct(1), false)
    })
    it('x String; false', async () => {
      assert.equal(Struct.isStruct('hey'), false)
    })
  })

  const nativeObjectToString = Object.prototype.toString

  const objectToString = x => nativeObjectToString.call(x)

  it('<T any>Struct.entries(x Array<T>) -> Iterator<[index number, T]>', async () => {
    assert.equal(objectToString(Struct.entries([1, 2, 3])), '[object Array Iterator]')
    assert.deepEqual([...Struct.entries([1, 2, 3])], [[0, 1], [1, 2], [2, 3]])
  })

  it('<T any>Struct.entries(x Object<T>) -> Iterator<[key string, T]>', async () => {
    assert.equal(objectToString(Struct.entries({ a: 1, b: 2, c: 3 })), '[object Generator]')
    assert.deepEqual([...Struct.entries({ a: 1, b: 2, c: 3 })], [['a', 1], ['b', 2], ['c', 3]])
  })

  it('<T any>Struct.entries(x Set<T>) -> Iterator<[T, T]>', async () => {
    assert.equal(objectToString(Struct.entries(new Set([1, 2, 3]))), '[object Set Iterator]')
    assert.deepEqual([...Struct.entries(new Set([1, 2, 3]))], [[1, 1], [2, 2], [3, 3]])
  })

  it('<A any, B any>Struct.entries(x Map<A, B>) -> Iterator<[A, B]>', async () => {
    assert.equal(objectToString(Struct.entries(new Map([[1, 'a'], [2, 'b'], [3, 'c']]))), '[object Map Iterator]')
    assert.deepEqual([...Struct.entries(new Map([[1, 'a'], [2, 'b'], [3, 'c']]))], [[1, 'a'], [2, 'b'], [3, 'c']])
  })

  describe('<T any>Struct.values(x Array<T>|Object<T>|Set<T>|Map<any, T>) -> Iterator<T>', () => {
    it('x Array<T>; Iterator<T>', async () => {
      assert.equal(objectToString(Struct.values([1, 2, 3])), '[object Array Iterator]')
      assert.deepEqual([...Struct.values([1, 2, 3])], [1, 2, 3])
    })
    it('x Object<T>; Iterator<T>', async () => {
      assert.equal(objectToString(Struct.values({ a: 1, b: 2, c: 3 })), '[object Generator]')
      assert.deepEqual([...Struct.values({ a: 1, b: 2, c: 3 })], [1, 2, 3])
    })
    it('x Set<T>; Iterator<T>', async () => {
      assert.equal(objectToString(Struct.values(new Set([1, 2, 3]))), '[object Set Iterator]')
      assert.deepEqual([...Struct.values(new Set([1, 2, 3]))], [1, 2, 3])
    })
    it('x Map<T>; Iterator<T>', async () => {
      assert.equal(objectToString(Struct.values(new Map([[1, 'a'], [2, 'b'], [3, 'c']]))), '[object Map Iterator]')
      assert.deepEqual([...Struct.values(new Map([[1, 'a'], [2, 'b'], [3, 'c']]))], ['a', 'b', 'c'])
    })
  })

  it('<T any>Struct.get(x Array<T>, index number) -> T|undefined', async () => {
    assert.equal(Struct.get([1, 2, 3], 0), 1)
    assert.strictEqual(Struct.get([1, 2, 3], 4), undefined)
  })

  it('<T any>Struct.get(x Object<T>, index string) -> T|undefined', async () => {
    assert.equal(Struct.get({ a: 1, b: 2, c: 3 }, 'a'), 1)
    assert.strictEqual(Struct.get({ a: 1, b: 2, c: 3 }, 'e'), undefined)
  })

  it('<T any>Struct.get(x Set<T>, index T) -> T|undefined', async () => {
    assert.equal(Struct.get(new Set([1, 2, 3]), 1), 1)
    assert.strictEqual(Struct.get(new Set([1, 2, 3]), 5), undefined)
  })

  it('<A any, B any>Struct.get(x Map<A, B>, index A) -> B|undefined', async () => {
    const m = new Map([[1, 'a'], [2, 'b'], [3, 'c']])
    assert.equal(Struct.get(m, 1), 'a')
    assert.strictEqual(Struct.get(m, 5), undefined)
  })
})
