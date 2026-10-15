// Polyfills for PDF.js and modern JS in older Electron/Chromium versions
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Promise.try === 'undefined') {
  Promise.try = function(fn) {
    return new Promise((resolve) => {
      try {
        resolve(fn());
      } catch (err) {
        const promise = new Promise((_, rej) => rej(err));
        resolve(promise);
      }
    });
  };
}

// Support for async iteration in older engines
if (typeof Symbol.asyncIterator === 'undefined') {
  Symbol.asyncIterator = Symbol.for('Symbol.asyncIterator');
}

console.log('Polyfills applied.');
