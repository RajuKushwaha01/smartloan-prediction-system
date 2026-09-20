const { generateApplicationId } = require('../utils/helpers');

describe('generateApplicationId', () => {
  test('generates an ID prefixed with SL-', () => {
    const id = generateApplicationId();
    expect(id).toMatch(/^SL-\d{6}$/);
  });

  test('generates unique IDs on consecutive calls', (done) => {
    const id1 = generateApplicationId();
    setTimeout(() => {
      const id2 = generateApplicationId();
      expect(id1).not.toBe(id2);
      done();
    }, 5);
  });
});ss