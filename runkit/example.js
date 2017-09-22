/* eslint-disable no-console */
/* eslint-disable no-sync */

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
