//     wink-regression-tree
//     Decision Tree to predict the value of a continuous
//     target variable
//
//     Copyright (C) 2017  GRAYPE Systems Private Limited
//
//     This file is part of “wink-regression-tree”.
//
//     “wink-regression-tree” is free software: you can redistribute it
//     and/or modify it under the terms of the GNU Affero
//     General Public License as published by the Free
//     Software Foundation, version 3 of the License.
//
//     “wink-regression-tree” is distributed in the hope that it will
//     be useful, but WITHOUT ANY WARRANTY; without even
//     the implied warranty of MERCHANTABILITY or FITNESS
//     FOR A PARTICULAR PURPOSE.  See the GNU Affero General
//     Public License for more details.
//
//     You should have received a copy of the GNU Affero
//     General Public License along with “wink-regression-tree”.
//     If not, see <http://www.gnu.org/licenses/>.

/* eslint no-continue: 0 */

var helpers = require( 'wink-helpers' );
var stdevEPSILON = Math.pow( 2, -48 );

// ### regressionTree
/**
 *
 * Creates an instance of **`wink-regression-tree`**.
 *
 * @return {methods} object conatining set of API methods for tasks like configuration,
 * data ingestion, learning, and prediction etc.
 * @example
 * // Load wink regression tree.
 * var regressionTree = require( 'wink-regression-tree' );
 * // Create your instance of regression tree.
 * var myRT = regressionTree();
*/
var regressionTree = function () {
  // Columns configuration supplied to the `defineConfig()` function.
  var columnsConfig;
  // Columns definition created from the `columnsConfig` supplied to the `defineConfig()`
  // method.
  var columnsDefn;
  // Create configuration object.
  var config = Object.create( null );
  // Returned!
  var methods = Object.create( null );
  // The **w**ink **r**egression tree.
  var wrTree = Object.create( null );
  // Xformed Column id to input column id map.
  var xc2cMap = [];
  // Xformed data, where categorical variables are encoded by a numeric code. Useful
  // in reduction of memory load.
  var xdata = [];
  // Parameters used for evaluation.
  var evalParams = Object.create( null );
  // Remember the target column name in this.
  var target;
  // Current rules tree object version.
  var winkRulesTreeVersion = 'WRT 1.0.0';

  // ### initColsDefn
  /**
   *
   * Initializes the columns' definition by cloning the input `cols` and by adding
   * a struncture containing `map` and `nextCode` (next unique value's code)
   * for every categorical column that is not excluded fom processing.
   *
   * @param {object[]} cols — each object specifies 4 properties viz. (a) `name`;
   * (b) type in terms of `categorical` as `true or false`, where `false` indicates a
   * continuous variable; (c) `exclude`, which is set to true if the column
   * has to be excluded from training; and (d) `target`, which is set to true for
   * the column whose value is to be predicted.
   * @return {object[]} cloned `cols`, where each element gets 2 addtitional
   * properties viz. `map` and the `nextCode` that is initialized to **0**.
   * @private
  */
  var initColsDefn = function ( cols ) {
    // Clone the incoming `cols`
    var cc = JSON.parse( JSON.stringify( cols ) );
    // Intialize the included categorical columns with empty `map` object
    // and `nextCode` that will be assigned to the next unique value encountered.
    for ( var i = 0, imax = cc.length; i < imax; i += 1 ) {
      if ( cc[ i ].categorical && !cc[ i ].exclude ) {
        cc[ i ].nextCode = 0;
        cc[ i ].map = Object.create( null );
        cc[ i ].invertedMap = [];
      }
      // Remember the target column name.
      if ( cc[ i ].target ) {
        target = cc[ i ].name;
      }
    }
    // Return the cloned & initialized collumns — `cc`.
    return cc;
  }; // initColsDefn()

  // ### transformRow
  /**
   *
   * It transforms the **included categorical** column's data of `row` into coded
   * values using `colsDefn`. This encoding reduces the memory space requirements.
   * If a new unique value is encountered, the `colsDefn.map` & `colsDefn.nextCode`
   *  values are accordingly updated.
   *
   * @param {array} row — contains data i.e. column values for a single row.
   * @param {object} colsDefn — columns' definition data structure.
   * @return {array} transformed row with encoded categorical column values.
   * @private
  */
  var transformRow = function ( row, colsDefn ) {
    // Transformed row builds up in this variable.
    var xRow = [ ];
    // Map, inverted Map and target value.
    var invertedMap, map, tv;
    for ( var i = 0, imax = row.length; i < imax; i += 1 ) {
      // Categorical and Included?
      if ( colsDefn[ i ].categorical && !colsDefn[ i ].exclude ) {
        map = colsDefn[ i ].map;
        invertedMap = colsDefn[ i ].invertedMap;
        // Map defined for row's element in question?
        if ( map[ row[ i ] ] === undefined ) {
          // Not! Update the `map` & the `invertedMap`.
          map[ row[ i ] ] = colsDefn[ i ].nextCode;
          invertedMap.push( row[ i ] );
          colsDefn[ i ].nextCode += 1;
        }
      }
      // Transform value.
      if ( colsDefn[ i ].target ) {
        // Remember target's transformed value, it will be pushed as the last
        // element in the `xRow`.
        tv = ( colsDefn[ i ].categorical ) ? map[ row[ i ] ] : row[ i ];
      } else if ( !colsDefn[ i ].exclude ) {
        // Ensure exclusion.
        xRow.push( map[ row[ i ] ] );
      }
    }
    // Target's value is always the last element in `xRow`.
    xRow.push( tv );
    return xRow;
  }; // transformRow()

  // ### createCandidates
  /**
   *
   * It creates empty data structure for each potential candidate column.
   *
   * @param {array} cols2p — array of indexes of columns to be processed.
   * @return {object} containing further empty objects indexed by each columns
   * specified in the `cols2p` array.
   * @private
  */
  var createCandidates = function ( cols2p ) {
    // Create `candidates` object.
    var candidates = Object.create( null );
    var ci;
    // Each Column specific data structure pertaining to every unique value goes here.
    candidates.columns = Object.create( null );
    // List of indexes of columns, to avoid calls to `Object.keys()` on candidate columns.
    candidates.list = [];
    for ( var i = 0, imax = cols2p.length; i < imax; i += 1 ) {
      ci = cols2p[ i ];
      // Push this index in to the list.
      candidates.list.push( ci );
      // Create an empty structure for this column by its index.
      candidates.columns[ ci ] = Object.create( null );
    }
    return candidates;
  }; // createCandidates()

  // ### computeMeanDelta
  /**
   *
   * Computes the delta mean value from the next `data`; this delta may be used to
   * update mean by additing it to the current mean.
   *
   * @param {number} data — data used to compute the delta.
   * @param {number} currMean — current value of mean from which delta is computed
   * using the `data`.
   * @param {number} size — the number of `data` items encountered so far.
   * @return {number} the delta mean.
   * @private
  */
  var computeMeanDelta = function ( data, currMean, size ) {
    return ( data - currMean ) / ( size );
  }; // computeMeanDelta()

  // ### computeVarianceXnDelta
  /**
   *
   * Computes the delta varianceXn value from the next `data`; this delta may be
   * used to update varianceXn by additing it to the current varianceXn. Note,
   * varianceXn is nothing but *sum of squared devaitions from the mean*.
   *
   * @param {number} data — data used to compute the delta.
   * @param {number} currMean — current value of mean and
   * @param {number} prevMean — the previous value of mean; using these delta is
   * computed using the `data`.
   * @return {number} the delta varianceXn.
   * @private
  */
  var computeVarianceXnDelta = function ( data, currMean, prevMean ) {
    return ( data - prevMean ) * ( data - currMean );
  }; // computeVarianceXnDelta()

  // ### computeStdev
  /**
   *
   * Computes the standard deviation from `varianceXn` and `size` after applying
   * Bessel's correction.
   *
   * @param {number} varianceXn — the sum of squared devaitions from the mean.
   * @param {number} size — the number of items.
   * @return {number} the standard deviation.
   * @private
  */
  var computeStdev = function ( varianceXn, size ) {
    // Apply Bessel's correction for a better estimate of population standard
    // deviation.
    return ( size > 1 ) ? Math.sqrt( varianceXn / ( size - 1 ) ) : 0;
  }; // computeStdev()

  // ### computePercentageVarianceReduction
  /**
   *
   * Computes percentage reduction in variance in split children from the parent.
   *
   * @param {number} varianceXn — the sum of squared devaitions from the mean.
   * @param {number} size — the number of items.
   * @param {number} weightedSumOfVar — weighted sum of variance of every child node.
   * @return {number} the percentage reduction in variance.
   * @private
  */
  var computePercentageVarianceReduction = function ( varianceXn, size, weightedSumOfVar ) {
    return ( ( ( varianceXn / size ) - weightedSumOfVar ) * 100 / ( varianceXn / size ) );
  }; // computePercentageVarianceReduction()

  // ### updateVarianceXn
  /**
   *
   * Incrementally updates the varianceXn of `targetsValue`  for the `c2psValue` of column to
   * process — `c2p` in `candidates` for the row pointed by `rowsIndex`.
   *
   * @param {object} candidates — data structure containing varianceXn for every
   * column's applicable unique values.
   * @param {number} c2p — the column to be processed.
   * @param {string} c2psValue — the column to be processed's value.
   * @param {number} rowsIndex — index of the data row to be used.
   * @param {number} targetsValue — target's value to be used for updating varianceXn.
   * @return {boolean} always true.
   * @private
  */
  var updateVarianceXn = function ( candidates, c2p, c2psValue, rowsIndex, targetsValue ) {
    // The candidates' colums where varianceXn will be updated.
    var cc2p = candidates.columns[ c2p ];
    // Create a place holder for `c2psValue`, provided it is being encountered
    // for the first time.
    if ( cc2p[ c2psValue ] === undefined ) {
      cc2p[ c2psValue ] = Object.create( null );
      // Mean of `targetsValue` encountered so far.
      cc2p[ c2psValue ].mean = 0;
      // The variance multiplied by `n or size`.
      cc2p[ c2psValue ].varianceXn = 0;
      // The count or size of values processed so far; will match with `index`
      // array size.
      cc2p[ c2psValue ].size = 0;
      // INdex of rows containing this specific value i.e. `c2psValue`.
      cc2p[ c2psValue ].index = [];
    }
    // Update varianceXn, etc.
    var prevMean = cc2p[ c2psValue ].mean;
    cc2p[ c2psValue ].size += 1;
    cc2p[ c2psValue ].mean += computeMeanDelta( targetsValue, cc2p[ c2psValue ].mean, cc2p[ c2psValue ].size );
    // ( targetsValue - cc2p[ c2psValue ].mean ) / ( cc2p[ c2psValue ].size );
    cc2p[ c2psValue ].varianceXn += computeVarianceXnDelta( targetsValue, cc2p[ c2psValue ].mean, prevMean );
    // ( targetsValue - prevMean ) * ( targetsValue - cc2p[ c2psValue ].mean );
    cc2p[ c2psValue ].index.push( rowsIndex );
    return true;
  }; // updateVarianceXn()

  // ### processRow
  /**
   *
   * It requires a `row` of data, columns to be processed —`c2p`, the `colsDefn`,
   * and a `node` that captures the column-wise varianceXn & mean for every unique
   * of the a column.
   *
   * @param {array} row — single row of transformed data that needs to be processed.
   * @param {number} rowsIndex — index of the row being passed.
   * @param {object} candidates — for split, contains all the statistic.
   * @param {function} updateFn — updates the statistic in `candidates`.
   * @return {object[]} ???
   * @private
  */
  var processRow = function ( row, rowsIndex, candidates, updateFn ) {
    // Single column to process from the array `cols2p`.
    var c2p;
    var indexOfTarget = row.length - 1;
    for ( var i = 0, imax = candidates.list.length; i < imax; i += 1 ) {
      c2p = candidates.list[ i ];
      updateFn( candidates, c2p, row[ c2p ], rowsIndex, row[ indexOfTarget ] );
    }
  }; // processRow()

  // ### selectBestSplit
  /**
   *
   * Finds the best candidate column for split on the basis of maximum reduction
   * in variance (impurity or maximum gain).
   *
   * @param {object} candidates — columns from where the best candidate for split
   * is selected.
   * @return {object} containing the best `col` and the corresponding wieghted
   * `sum` of squared deviation from mean for each unique value.
   * @private
  */
  var selectBestSplit = function ( candidates ) {
    // Used in for-in loop: unique values (`uvs`) in a `col`.
    var col, uvs;
    // Sum of `varianceXn * size` for each `uvs` in a `col`; and its size.
    var size, sum;
    // Used to compute average children item for minAvgChildrenItems config.
    var counter, meanSize;
    // Minimum Sum and the Best Column.
    var bestCol, minSum;

    minSum = Infinity;
    bestCol = -1;
    for ( col in candidates.columns ) { // eslint-disable-line guard-for-in
      // Initialize `sum` and `size` for this `col`.
      sum = 0;
      size = 0;
      // And also counter & meanSize.
      counter = 0;
      meanSize = 0;
      for ( uvs in candidates.columns[ col ] ) { // eslint-disable-line guard-for-in
        size += candidates.columns[ col ][ uvs ].size;
        // Compute average (mean) children items.
        counter += 1;
        meanSize += computeMeanDelta( candidates.columns[ col ][ uvs ].size, meanSize, counter );
        // Compute weighted sum; will divide by sum after the loop finishes to normalize.
        // Recall, `varianceXn` is variance multiplied by items.
        sum += ( candidates.columns[ col ][ uvs ].varianceXn /* candidates.columns[ col ][ uvs ].size */ );
      }
      // Normalize - this will yield weighted sum of variances.
      sum /= size;
      // Update minumum only if `meanSize` is above the defined threshold.
      if ( ( sum < minSum ) && ( meanSize > config.minAvgChildrenItems ) ) {
        minSum = sum;
        bestCol = col;
      }
    }
    // If the best column is not found, return `undefined`.
    return ( bestCol === -1 ) ? undefined : { col: +bestCol, sum: minSum };
  }; // selectBestSplit()

  // ### growTree
  /**
   *
   * Builds the tree recursively by maximaizing the variance reduction on each
   * split.
   *
   * @param {object} cc — candidate columns to consider for further growing the
   * tree.
   * @param {number} splitData — columns on which split occurred.
   * @param {number} colUsed4Split — column used for creating the `splitData`.
   * @param {object} node — node of the tree, from where tree may be grown further.
   * @param {number} depth — of the tree so far.
   * @return {object} the tree!
   * @private
  */
  var growTree = function ( cc, splitData, colUsed4Split, node, depth ) {
    // Maximum defined depth reached?
    if ( depth > config.maxDepth ) {
      // Yes, return.
      return;
    }

    var cCols;
    var colsLeft;
    var bs, uniqVal;
    var varianceReduction;
    var child;
    // Helper variables
    var index, j, k, kmax;
    node.branches = Object.create( null );
    for ( uniqVal in splitData ) {
      // Node contains enough items to be retained in the tree?
      if ( splitData[ uniqVal ].size < config.minLeafNodeItems ) {
        // Just skip this iteration.
        continue;
      }
      // Node has enough items! Setup the child node.
      child = node.branches[ columnsDefn[ xc2cMap[ colUsed4Split ] ].invertedMap[ +uniqVal ] ] = Object.create( null );
      child.size = splitData[ uniqVal ].size;
      child.mean = splitData[ uniqVal ].mean;
      child.stdev = computeStdev( splitData[ uniqVal ].varianceXn, splitData[ uniqVal ].size );
      // Create candidate colums for this node. These will be used to obtain bestCol
      // split as per the `config`.
      cCols = createCandidates( cc );
      index = splitData[ uniqVal ].index;
      // Does it have enough items to proceed with split?
      if ( index.length <= config.minSplitCandidateItems || child.stdev < stdevEPSILON ) {
        // No! continue with the iteration with the next `uniqVal`.
        continue;
      }
      // Attempt split.
      for ( k = 0, kmax = index.length; k < kmax; k += 1 ) {
        processRow( xdata[ index[ k ] ], index[ k ], cCols, updateVarianceXn );
      }
      bs = selectBestSplit( cCols );
      if ( bs === undefined ) {
        // No best column found, coninue with the next one!
        continue;
      }
      varianceReduction = computePercentageVarianceReduction( splitData[ uniqVal ].varianceXn, splitData[ uniqVal ].size, bs.sum );
      // Reasonable variance reduction?
      if ( varianceReduction < config.minPercentVarianceReduction ) {
        // No! continue with the iteration with the next `uniqVal`.
        continue;
      }
      // Yes, split possible! Make a list of left columns by removing the columns
      // found for splitting.
      colsLeft = [];
      for ( j = 0; j < cc.length; j += 1 ) {
        if ( cc[ j ] !== bs.col ) colsLeft.push( cc[ j ] );
      }
      // Recurse!
      child.colUsed4Split = columnsDefn[xc2cMap[bs.col]].name;
      child.varianceReduction = varianceReduction;
      growTree( colsLeft, cCols.columns[ bs.col ], bs.col, child, ( depth + 1 ) );
    }
  }; // growTree()

  // ### countRules
  /**
   *
   * Counts the number of rules generated from a rules tree and updates the final
   * number in the root node of the tree.
   *
   * @param {object} tree — the rules tree.
   * @return {undefined} or void!
   * @private
  */
  var countRules = function ( tree ) {
    var subTree = tree.branches;
    for ( var node in subTree ) {
      if ( subTree[ node ].branches !== undefined && Object.keys( subTree[ node ].branches ).length > 0 ) {
        countRules( subTree[ node ] );
      } else wrTree.rulesLearned += 1;
    }
  }; // countRules()

  // ### defineConfig
  /**
   *
   * Defines the configuration required to read the input data and to generates
   * the regression tree.
   *
   * @param {object[]} inputDataCols — each object in this array defines a column of input
   * data in the same sequence in which data will be supplied to `ingest().` It is
   * defined in terms of the following details:
   * @param {string} inputDataCols[].name of the column.
   * @param {boolean} inputDataCols[].categorical defines column's data type — `true` indicating categorical
   * **or** `false` indicating numeric; currently numeric data type is not supported.
   * @param {boolean} [inputDataCols[].exclude=false] used to exclude a column during tree building.
   * @param {boolean} [inputDataCols[].target=false] is set to `true` only for the target column, whose
   * value needs to be predicted. Note this column must be a numeric column.
   * @param {object} tree — contains key value pairs of the following regression
   * tree's parameters:
   * @param {number} [tree.maxDepth=20] is the maximum depth of the tree after which
   * learning stops.
   * @param {number} [tree.minPercentVarianceReduction=10] is the minmum variance reduction
   * required for a split to occur.
   * @param {number} [tree.minSplitCandidateItems=50] the minimum items that must be present
   * at a node for it to be split further, even after the `minPercentVarianceReduction`
   * target has been achieved.
   * @param {number} [tree.minLeafNodeItems=10] is the minimum number of items that
   * must be present at a leaf node to be retained as a part of rule tree.
   * @param {number} [tree.minAvgChildrenItems=2] the average number of items
   * across children must be greater than this number, for a column to become a candidate
   * for split. A higher number will discourage splits that creates many branches
   * with each child node containing fewer items.
   * @return {number} number of columns defined.
   * @example
   * // Define each column.
   * var columns = [
   *   { name: 'model', categorical: true, exclude: true },
   *   { name: 'mpg', categorical: false, target: true },
   *   { name: 'cylinders', categorical: true },
   *   { name: 'displacement', categorical: true, exclude: false },
   *   { name: 'horsepower', categorical: true, exclude: false },
   *   { name: 'weight', categorical: true, exclude: false },
   *   { name: 'acceleration', categorical: true, exclude: false },
   *   { name: 'year', categorical: true, exclude: true },
   *   { name: 'origin', categorical: true, exclude: false  }
   * ];
   * // Define parameters to grow the tree.
   * var treeParams = {
   *   minPercentVarianceReduction: 2.5,
   *   minLeafNodeItems: 10,
   *   minSplitCandidateItems: 30,
   *   minAvgChildrenItems: 3
   * };
   * // Define the configuration using above 2 variables.
   * myRT.defineConfig( columns, treeParams );
   * // -> 8
  */
  var defineConfig = function ( inputDataCols, tree ) {
    config.maxDepth = tree.maxDepth || config.maxDepth;
    config.minPercentVarianceReduction = tree.minPercentVarianceReduction || config.minPercentVarianceReduction;
    config.minSplitCandidateItems = tree.minSplitCandidateItems || config.minSplitCandidateItems;
    config.minLeafNodeItems = tree.minLeafNodeItems || config.minLeafNodeItems;
    config.minAvgChildrenItems = tree.minAvgChildrenItems || config.minAvgChildrenItems;
    columnsConfig = inputDataCols;
    columnsDefn = initColsDefn( columnsConfig );
    return inputDataCols.length;
  }; // defineConfig();

  // ### ingest
  /**
   *
   * Ingests one row of the data at a time. It is specially useful for reading
   * data in an asynchronus manner, where this may be used as a call back function
   * on every row read event.
   *
   * @param {array} row — one row of the data to be ingested; column values
   * should be in the same sequence in which they are defined in data configuration
   * via `defineConfig()`.
   * @return {boolean} always `true`.
   * @throws {error} if number of elements in `row` don't match with the
   * number of columns defined.
   * @example
   * // Load cars training data set.
   * var cars = require( 'wink-regression-tree/sample-data/cars.json' );
   * // Ingest the data.
   * cars.forEach( function ( row ) {
   *   myRT.ingest( row );
   * } );
  */
  var ingest = function ( row ) {
    if ( row.length === columnsConfig.length ) {
      xdata.push( transformRow( row, columnsDefn ) );
    } else {
      throw Error( 'winkRT: ingest is expecting ' + columnsConfig.length + ' elements instead found: ' + row.length );
    }
    return true;
  }; // ingest()

  // ### learn
  /**
   *
   * Learns from the ingested data and generates the rule tree that is used to
   * `predict()` the value of target variable from the input. It requires at least
   * 60 data rows to initiate meaningful learning.
   *
   * @return {number} number of rules learned from the input data.
   * @throws {error} if number of rows in the ingested data are <60.
   * @example
   * myRT.learn();
   * // -> Number of rules learned
  */
  var learn = function ( ) {
    if ( xdata.length < 60 ) {
      throw Error( 'winkRT: learn is expecting at least 60 rows of data, instead found: ' + xdata.length );
    }
    // Candidate columns list
    var candidateCols = [];
    // Candidate columns created using above list.
    var cndts;
    // Required for the root node.
    var rootsMean = 0;
    var rootsVarianceXn = 0;
    var prevRootsMean;
    // Index of the target variable (Y).
    var indexOfTarget;
    // Object containing best split info in terms of the column and the
    // weighted `sum` of variance.
    var bestSplit;
    // Updated candidate columns list after split.
    var updatedCandidateCols = [];
    // Helper variables
    var i, imax;
    var k = 0;

    // Create candidate columns list & `xc2cMap`.
    for ( i = 0, imax = columnsConfig.length; i < imax; i += 1 ) {
      if ( !columnsConfig[ i ].exclude ) {
        if ( !columnsConfig[ i ].target ) {
          xc2cMap.push( i );
          candidateCols.push( k );
          k += 1;
        }
      }
    }

    cndts = createCandidates( candidateCols );

    indexOfTarget = xdata[ 0 ].length - 1;
    // Process every row as this is the root level.
    for ( i = 0; i < xdata.length; i += 1 ) {
      processRow( xdata[ i ], i, cndts, updateVarianceXn );
      prevRootsMean = rootsMean;
      rootsMean += computeMeanDelta( xdata[ i ][ indexOfTarget ], rootsMean, ( i + 1 ) );
      rootsVarianceXn += computeVarianceXnDelta( xdata[ i ][ indexOfTarget ], rootsMean, prevRootsMean );
    }
    // Define minimal root node stuff here itself.
    wrTree.version = winkRulesTreeVersion;
    wrTree.size = xdata.length;
    wrTree.mean = rootsMean;
    wrTree.stdev = computeStdev( rootsVarianceXn, wrTree.size );
    // Attempt to grow tree if standard deviation is large enough!
    if ( wrTree.stdev > stdevEPSILON ) {
      bestSplit = selectBestSplit( cndts );
      if ( bestSplit === undefined ) {
        // Opps, no worthy column available - return the root!
        return true;
      }
      // Find the updated list of candidate columsn after the split.
      for ( i = 0; i < candidateCols.length; i += 1 ) {
        if ( candidateCols[ i ] !== bestSplit.col ) updatedCandidateCols.push( candidateCols[ i ] );
      }
      // Define the balance stuff as a split has been found!
      wrTree.colUsed4Split = columnsDefn[xc2cMap[bestSplit.col]].name;
      wrTree.varianceReduction = computePercentageVarianceReduction( rootsVarianceXn, wrTree.size, bestSplit.sum );
      // Call recursive function, `growTree()`.
      growTree( updatedCandidateCols, cndts.columns[ bestSplit.col ], bestSplit.col, wrTree, 1 );
    }
    wrTree.rulesLearned = 0;
    countRules( wrTree );
    return wrTree.rulesLearned;
  }; // learn()

  // ### navigateRules
  /**
   *
   * Recursively navigaes the rule tree to arrive at a prediction for the
   * `input` data. If the value of a columm in the input data, required during
   * the prediction is missing, it throws an error provided the function
   * `f` is not defined. Otherwise the name of column is passed to this function;
   * and the function is expected to handle the same.
   *
   * @param {object} input — data containing column name/value pairs; the column
   * names must the same as defined via `defineConfig()`.
   * @param {object} rules — the rules tree generated during `learn()`; on every
   * recursion a branch of tree is passed.
   * @param {function} [f=undefined] — is called once
   * a leaf node is reached during prediction with the following 4 parameters: **size,**
   * **mean** and **stdev** values at the node; an **array** of column names
   * navigated to reach the leaf and **column name** for which value is missing
   * in the input (if found). The value returned from this function becomes  the prediction.
   * @param {array} colsUsed4Prediction — columns used for prediction are pushed into this array; if
   * this is empty then it means no rules matched and prediction occurred using
   * the root node.
   * @return {number} `mean` value or whatever is returned by the `fn` function, if defined.
   * @private
  */
  var navigateRules = function ( input, rules, f, colsUsed4Prediction ) {
    // Sub-tree is present if # of branches > 0.
    var hasSubTree = helpers.object.isObject( rules.branches ) &&
                        ( ( Object.keys( rules.branches ) ).length > 0 );


    var inputHasReqdValue = false;
    var stopNavigation = true;
    var column;
    var reqdValue;

    if ( !hasSubTree ) {
      // No subTree, return!
      return (
        ( typeof f === 'function' ) ?
          f( rules.size, rules.mean, rules.stdev, colsUsed4Prediction ) :
          rules.mean
      );
    }
    // Sub-tree is present, check if the input has a value for `colUsed4Split`.
    column = rules.colUsed4Split;

    inputHasReqdValue = ( ( input[ column ] !== undefined ) &&
      ( input[ column ] !== null ) );

    if ( inputHasReqdValue ) {
      // Lookup `reqdValue` from the input.
      reqdValue = input[ column ];
      // If there is no branch corresponding to the `reqdValue` then stop naigation.
      stopNavigation = !helpers.object.isObject( rules.branches[ reqdValue ] );
    } else {
      // Input does not have the value for column.
      if ( typeof f !== 'function' ) {
        // No `f` defined, throw error.
        throw Error( 'winkRT: missing column value for the column found during prediction: ' + JSON.stringify( column ) );
      }
      // The `f` is defined, let it handle.
      return f( rules.size, rules.mean, rules.stdev, colsUsed4Prediction, column );
    }

    if ( stopNavigation ) {
      return (
        ( typeof f === 'function' ) ?
          f( rules.size, rules.mean, rules.stdev, colsUsed4Prediction ) :
          rules.mean
      );
    }
    // Continue navigation!
    colsUsed4Prediction.push( rules.colUsed4Split );
    return navigateRules( input, rules.branches[ reqdValue ], f, colsUsed4Prediction );
  }; // navigateRules()

  // ### predict
  /**
   *
   * Predicts the value of target variable from the `input` using the rules tree generated by
   * `learn()`. If the value of a columm in the input data, required for
   * the prediction is missing, by defualt it throws an error. If the function
   * `fn` is defined then no error is thrown, instead the name of missing column is passed
   * to this function; and the function is expected to handle the same.
   *
   * @param {object} input — data containing column name/value pairs; the column
   * names must the same as defined via `defineConfig()`.
   * @param {function} [modifier=undefined] — is called once
   * a leaf node is reached during prediction with the following 5 parameters: **size,**
   * **mean** and **stdev** values at the node; an **array** of column names
   * navigated to reach the leaf and **column name** for which value is missing
   * in the input (`default=undefined`). The value returned from this function becomes  the prediction.
   * @return {number} `mean` value or whatever is returned by the `modifier` function, if defined.
   * @throws {error} if the `input` is not a javascript object.
   * @throws {error} if a value of a column required for prediction is missing in `input`,
   * provided `modifier` has not been defined.
   * @example
   * // Populate sample input
   * var input = {
   *   model: 'Ford Gran Torino',
   *   weight: 'very high weight',
   *   displacement: 'very large displacement',
   *   horsepower: 'extremely high power',
   *   origin: 'US',
   *   acceleration: 'slow'
   * };
   * // Attempt prediction.
   * myRT.predict( input );
   * // -> 14.3
  */
  var predict = function ( input, modifier ) {
    if ( !helpers.object.isObject( input ) ) {
      throw Error( 'winkRT: input for prediction must be an object, instead found: ' + ( typeof input ) );
    }
    var colsUsed4Prediction = [];
    return navigateRules( input, wrTree, modifier, colsUsed4Prediction );
  }; // predict()

  // ### navigateRules4Stats
  /**
   *
   * Recursively navigaes the rule tree to generate the summary by extracting the
   * level wise column hierarchy, nodes that were split on this hierarchy, min &
   * max variance reduction, etc.
   *
   * @param {object} subTree — the rules tree generated during `learn()`; on every
   * recursion a branch of tree is passed.
   * @param {object} stats — summary of min/max means and their corresponding stdevs
   * along with the overall `minSD` — minimum stdev.
   * @param {stats} colImp — contains depth wise column hierarchy, number of nodesSplit
   * and the min/max varaiance reduction at that level.
   * @param {number} depth — the current depth of the tree.
   * @param {string} ch — column's hierarchy in the unix file/folder naming style.
   * @return {undefined} nothing!
   * @private
  */
  var navigateRules4Stats = function ( subTree, stats, colImp, depth, ch ) {
    var chVal = ch;
    if ( subTree.branches && ( Object.keys( subTree.branches ) ).length > 0 ) {
      // Update column's hierarchy in unix styled path names.
      chVal += '/' + subTree.colUsed4Split;
      // Initialize stats at the current `depth` and `ch` level.
      colImp[ depth ] = colImp[ depth ] || Object.create( null );
      if ( colImp[ depth ][ chVal ] === undefined ) {
        colImp[ depth ][ chVal ] = Object.create( null );
        colImp[ depth ][ chVal ].nodesSplit = 0;
        colImp[ depth ][ chVal ].minVR = Infinity;
        colImp[ depth ][ chVal ].maxVR = -Infinity;
      }
      // Update stats.
      colImp[ depth ][ chVal ].nodesSplit += 1;
      // Update min/max varaiance reductions.
      colImp[ depth ][ chVal ].minVR = Math.min( colImp[ depth ][ chVal ].minVR, +subTree.varianceReduction.toFixed( 4 ) );
      colImp[ depth ][ chVal ].maxVR = Math.max( colImp[ depth ][ chVal ].maxVR, +subTree.varianceReduction.toFixed( 4 ) );

      for ( var key in subTree.branches ) {
        // Update summary!
        if ( stats.min.mean > subTree.branches[ key ].mean ) {
          stats.min.mean = subTree.branches[ key ].mean;
          stats.min.itsSD = subTree.branches[ key ].stdev;
        }
        if ( stats.max.mean < subTree.branches[ key ].mean ) {
          stats.max.mean = subTree.branches[ key ].mean;
          stats.max.itsSD = subTree.branches[ key ].stdev;
        }
        stats.minSD = Math.min( stats.minSD, subTree.branches[ key ].stdev );
        // Time to dig deeper!!
        navigateRules4Stats( subTree.branches[ key ], stats, colImp, ( depth + 1 ), chVal );
      }
    }
  }; // navigateRules4Stats()

  // ### summary
  /**
   *
   * Generates summary of the learnings in terms of the following:<ol>
   * <li>Relative importance of columns along with the corresponding min/max
   * variance reductions (VR).</li>
   * <li>The min/max mean values along with the corresponding standard
   * deviations (SD).</li>
   * <li>The minumum standard deviation (SD) discovered during the learning.</li></ol>
   *
   * @return {object} containing the following:<ol>
   * <li><code>table</code> — array of objects, where each object defines <code>level</code>, <code>columnHierarchy</code>,
   * <code>nodesSplit</code>, <code>minVR</code> and <code>maxVR</code>. A lower value of <code>level</code>
   * indicates higher importance; similarly more nodes at a level split on a columnHierarchy
   * is an indication of importance. Therefore, it is sorted in ascending order of <code>level</code>
   * followed by in descending order of <code>nodesSplit</code>.</li>
   * <li><code>stats</code> — object containing <code>min.mean</code>, <code>min.itsSD</code>, <code>max.mean</code>, <code>max.itsSD</code>,
   * and <code>minSD</code>.</li></ol>
   * @example
   * myRT.summary();
   * // -> returns the summary object.
  */
  var summary = function () {
    // Column imporatnce is captured first in an object to ease hashing and later
    // converted to a table.
    var columnsImportance = Object.create( null );
    var table = [];
    // Current depth of the tree.
    var depth = 1;
    // In unix style file paths.
    var columnHierarchy = '';
    // To capture min/max means and their stdevs, etc.
    var stats = Object.create( null );
    // Helper variables.
    var ch, level;

    // Initialize.
    stats.min = Object.create( null );
    stats.max = Object.create( null );
    stats.minSD = Infinity;
    stats.min.mean = Infinity;
    stats.min.itsSD = 0;
    stats.max.mean = -Infinity;
    stats.max.itsSD = 0;
    // Buld summary recursively.
    navigateRules4Stats( wrTree, stats, columnsImportance, depth, columnHierarchy );
    // Convert to `table`.
    for ( level in columnsImportance ) { // eslint-disable-line guard-for-in
      for ( ch in columnsImportance[ level ] ) { // eslint-disable-line guard-for-in
        table.push( {
          level: +level,
          columnHierarchy: ch,
          nodesSplit: columnsImportance[ level ][ ch ].nodesSplit,
          minVR: columnsImportance[ level ][ ch ].minVR,
          maxVR: columnsImportance[ level ][ ch ].maxVR,
        } );
      }
    }
    // Sort on level (asc) and then on nodesSplit(dsc).
    table.sort( function ( a, b ) {
      return (
        ( a.level > b.level ) ? 1 :
          ( a.level < b.level ) ? -1 :
            ( a.nodesSplit < b.nodesSplit ) ? 1 : -1
      );
    } );
    // Return summary!
    return { columnsImportance: table, stats: stats };
  }; // summary()

  // ### evaluate
  /**
   *
   * Incrementally evalutes variance reduction for one data row at a time.
   *
   * @param {object} rowObject — contains column name/value pairs including the target column
   * name/value pair as well, which is used in evaluating the variance reduction.
   * @return {boolean} always `true`.
   * @example
   * myRT.evaluate( input );
  */
  var evaluate = function ( rowObject ) {
    var pv = predict( rowObject );
    evalParams.prevMean = evalParams.mean;
    evalParams.size += 1;
    evalParams.mean += computeMeanDelta( rowObject[ target ], evalParams.mean, evalParams.size );
    evalParams.gssdm += computeVarianceXnDelta( rowObject[ target ], evalParams.mean, evalParams.prevMean );
    evalParams.ssdm += ( ( rowObject[ target ] - pv ) * ( rowObject[ target ] - pv ) );
    return true;
  }; // evaluate()

  // ### metrics
  /**
   *
   * Computes the variance reduction observed in the validation data passed to
   * `evaluate()`.
   *
   * @return {object} containing the `varianceReduction` in percentage and data `size`.
   * @example
   * myRT.metrics();
   * // -> object containing varianceReduction and data size.
  */
  var metrics = function ( ) {
    return (
      {
        size: evalParams.size,
        varianceReduction: +( ( evalParams.gssdm - evalParams.ssdm ) * 100 / evalParams.gssdm ).toFixed( 4 ),
      }
    );
  }; // metrics()

  // ### exportJSON
  /**
   *
   * Exports the JSON of the rule tree generated by `learn()`, which may be
   * saved in a file for later predictions.
   *
   * @return {json} of the rule tree.
   * @example
   * var rules = myRT.exportJSON();
  */
  var exportJSON = function () {
    return JSON.stringify( wrTree );
  }; // exportJSON()

  // ### importJSON
  /**
   *
   * Imports the rule tree from the input `rulesTree` for subsequent use by `predict()`.
   * Note after a successful import, this can be used ONLY for prediction purpose
   * and not for further ingestion and/or learning.
   * @param {json} rulesTree — containg an earlier exported rule tree in JSON format.
   * @return {boolean} always `true`.
   * @throws {error} if `rulesTree` is `null`.
   * @throws {error} if `rulesTree` can not be parsed as a valid JSON.
   * @throws {error} if `rulesTree` is of incorrect version or incorrect format.
   * @example
   * var anRT = regressionTree();
   * // Assuming that json has a valid rule tree.
   * anRT.importJSON( rules );
  */
  var importJSON = function ( rulesTree ) {
    if ( !rulesTree ) {
      throw Error( 'winkRT: undefined or null JSON encountered, import failed!' );
    }
    try {
      wrTree = JSON.parse( rulesTree );
    } catch ( ex ) {
      throw Error( 'winkRT: JSON parsing error during import:\n\t' + ex.message );
    }
    if ( wrTree.version !== winkRulesTreeVersion ) {
      throw Error( 'winkRT: incorrect json format or tree version, import failed!' );
    }
    return true;
  }; // importJSON()

  // Set default configuration;
  config.maxDepth = 20;
  config.minPercentVarianceReduction = 10;
  config.minSplitCandidateItems = 50;
  config.minLeafNodeItems = 10;
  // This will ensure that split will never occurr on uniq id like columns!
  config.minAvgChildrenItems = 2;
  // Initialize the number of rules learned.
  wrTree.rulesLearned = 0;

  // Setup evaluation parameters.
  evalParams.size = 0;
  evalParams.mean = 0;
  evalParams.prevMean = 0;
  // Grand Sum of Squared Deviations from the Mean, prior to prediction.
  evalParams.gssdm = 0;
  // Sum of Squared Deviations from the Mean, post prediction
  evalParams.ssdm = 0;

  methods.defineConfig = defineConfig;
  methods.ingest = ingest;
  methods.learn = learn;
  methods.predict = predict;
  methods.evaluate = evaluate;
  methods.metrics = metrics;
  // Setup an alias `stats()` to maintain similarity with other ML packages
  // such as naive bayes, etc.
  methods.stats = methods.summary = summary;
  methods.exportJSON = exportJSON;
  methods.importJSON = importJSON;

  return methods;
}; // regressionTree()

// Export
module.exports = regressionTree;
