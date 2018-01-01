# wink-regression-tree

Decision Tree to predict the value of a continuous target variable

### [![Build Status](https://api.travis-ci.org/winkjs/wink-regression-tree.svg?branch=master)](https://travis-ci.org/winkjs/wink-regression-tree) [![Coverage Status](https://coveralls.io/repos/github/winkjs/wink-regression-tree/badge.svg?branch=master)](https://coveralls.io/github/winkjs/wink-regression-tree?branch=master) [![Inline docs](http://inch-ci.org/github/winkjs/wink-regression-tree.svg?branch=master)](http://inch-ci.org/github/winkjs/wink-regression-tree) [![dependencies Status](https://david-dm.org/winkjs/wink-regression-tree/status.svg)](https://david-dm.org/winkjs/wink-regression-tree) [![devDependencies Status](https://david-dm.org/winkjs/wink-regression-tree/dev-status.svg)](https://david-dm.org/winkjs/wink-regression-tree?type=dev)

<img align="right" src="https://decisively.github.io/wink-logos/logo-title.png" width="100px" >

Predict the value of a continuous variable such as price, turn around time, or mileage using **`wink-regression-tree`**. It is a part of [wink](http://winkjs.org/) — a growing family of high quality packages for Statistical Analysis, Natural Language Processing and Machine Learning in NodeJS.


### Installation

Use [npm](https://www.npmjs.com/package/wink-regression-tree) to install:

    npm install wink-regression-tree --save

### Getting Started
Here is an example of predicting car’s mileage (miles per gallon - mpg) from attributes like displacement, horsepower, acceleration, country of origin, and few more. A sample data row is given for quick reference:

| Model          | MPG | Cylinders | Displacement | Power | Weight | Acceleration | Year | Origin |
|--------------|-----|----------|------------------|----------|-----------|----|---|-----|
|Toyota Mark II|20|6|large displacement|high power|high weight|slow|73|Japan|

The code below provides a potential configuration to predict the value of miles per gallon:

```javascript
// Load wink-regression-tree.
var regressionTree = require( 'wink-regression-tree' );

// Load cars training data set.
// In practice an async mechanism may be used to
// read data asynchronously and call `ingest()` on
// every row of data read.
var cars = require( 'wink-regression-tree/sample-data/cars.json' );

// Create a sample data to test prediction for
// Ford Gran Torino, having "mpg of 14.5", very
// large displacement, extremely high power, very
// high weight, slow, and with origin as US.
var input = {
  model: 'Ford Gran Torino',
  weight: 'very high weight',
  displacement: 'very large displacement',
  horsepower: 'extremely high power',
  origin: 'US',
  acceleration: 'slow'
};
// Above record is not the part of training data.

// Create an instance of the regression  tree.
var rt = regressionTree();

// Specify columns of the training data.
var columns = [
  { name: 'model', categorical: true, exclude: true },
  { name: 'mpg', categorical: false, target: true },
  { name: 'cylinders', categorical: true, exclude: false },
  { name: 'displacement', categorical: true, exclude: false },
  { name: 'horsepower', categorical: true, exclude: false },
  { name: 'weight', categorical: true, exclude: false },
  { name: 'acceleration', categorical: true, exclude: false },
  { name: 'year', categorical: true, exclude: true },
  { name: 'origin', categorical: true, exclude: false  }
];
// Specify configuration for learning.
var treeParams = {
  minPercentVarianceReduction: 0.5,
  minLeafNodeItems: 10,
  minSplitCandidateItems: 30,
  minAvgChildrenItems: 2
};
// Define the regression tree configuration using
// `columns` and `treeParams`.
rt.defineConfig( columns, treeParams );

// Ingest the data.
cars.forEach( function ( row ) {
  rt.ingest( row );
} );

// Data ingested! Now time to learn from data!!
console.log( rt.learn() );
// -> 16 (Number of Rules Learned)

// Predict the **mean** value.
var mean = rt.predict( input );
console.log( +mean.toFixed( 1 ) );
// -> 14.3 ( compare with actual mpg of 14.5 )

// In practice one may like to compute a range
// or upper limit using the `modifier` function
// during prediction. Note `size`, `mean`, and `stdev`
// values, passed to this function, can be used
// for computing the range or the upper limit.
```

Try [experimenting with this example on Runkit](https://npm.runkit.com/wink-regression-tree) in the browser.

### Documentation
For detailed API docs, check out http://winkjs.org/wink-regression-tree/ URL!

### Need Help?

If you spot a bug and the same has not yet been reported, raise a new [issue](https://github.com/winkjs/wink-regression-tree/issues) or consider fixing it and sending a pull request.

### Copyright & License

**wink-regression-tree** is copyright 2017 [GRAYPE Systems Private Limited](http://graype.in/).

It is licensed under the under the terms of the GNU Affero General Public License as published by the Free
Software Foundation, version 3 of the License.
