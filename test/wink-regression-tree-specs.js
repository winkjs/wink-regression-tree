//     wink-regression-tree
//     Decision Tree to predict the value of a continuous
//     target variable
//
//     Copyright (C) 2017-18  GRAYPE Systems Private Limited
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


//
var chai = require( 'chai' );
var mocha = require( 'mocha' );
var wrt = require( '../src/wink-regression-tree.js' );
var fs = require( 'fs' );

var summary = require( '../test/data/summary.json' );
var rules = require( '../test/data/rules.json' );

var expect = chai.expect;
var describe = mocha.describe;
var it = mocha.it;

// Sample input to test prediction to the maximum depth of the tree.
var inp1 = { weight: 'high weight', displacement: 'large displacement', horsepower: 'high power', origin: 'US', acceleration: 'faster', cylinders: 6 };
var inp2 = { weight: 'high weight', displacement: 'large displacement', horsepower: 'high power', origin: 'Japan', acceleration: 'faster', cylinders: 6 };
// Load & prepare the training data.
var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
cars.pop();

describe( 'Instantiating Wink Regression Tree', function () {
  it( 'should return an object', function () {
    expect( typeof wrt() ).to.equal( 'object' );
  } );
} );


describe( 'Run Basic Test Cycle with Quantized Car Data', function () {
  it( 'should return JSON string & metrics with variance reduction of 77.2636%', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: false },
      { name: 'acceleration', categorical: true, exclude: false },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: false  }
    ];

    var f = function ( size, mean, stdev, cols, missingCol ) {
      return [ size, +mean.toFixed( 4 ), +stdev.toFixed( 4 ), cols.join( '/' ), missingCol ];
    };
    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 10, minSplitCandidateItems: 30, minAvgChildrenItems: 2 } );
    cars.forEach( function ( row ) {
      rt.ingest( row.split( ',' ) );
    } );
    // Test number of rules learned!
    expect( rt.learn() ).to.equal( 23 );
    cars.forEach( function ( row ) {
      var r = row.split( ',' );
      rt.evaluate( { model: r[0], mpg: r[1], cylinders: r[2], displacement: r[3], horsepower: r[4], weight: r[5], acceleration: r[6], year: r[7], origin: r[8] } );
    } );
    // console.log( JSON.stringify( JSON.parse( rt.exportJSON() ), null, 2 ) ); // eslint-disable-line no-console
    expect( typeof rt.exportJSON() ).to.equal( 'string' );
    expect( rt.metrics() ).to.deep.equal( { size: 394, varianceReduction: 77.2636 } );
    // Test navigation to the deppest level of tree.
    expect( +( rt.predict( inp1 ) ).toFixed( 4 ) ).to.equal( 19.8533 );
    // Same test with a handller function.
    expect( rt.predict( inp1, f ) ).to.deep.equal( [ 30, 19.8533, 4.044, 'weight/displacement/cylinders/acceleration', undefined ] );
    expect( rt.predict( inp2, f ) ).to.deep.equal( [ 30, 19.8533, 4.044, 'weight/displacement/cylinders/acceleration', undefined ] );
    // console.log( rt.predict( inp2, f ) ); // eslint-disable-line no-console
    // Missing column value with handler - will give column name.
    expect( rt.predict( { weight: 'high weight' }, f ) ).to.deep.equal( [ 99, 20.5131, 4.3304, 'weight', 'displacement' ] );
    // Does not have $$other_values, return parent node's stuff.
    expect( rt.predict( { weight: 'high weight', displacement: 'unk' }, f ) ).to.deep.equal( [ 99, 20.5131, 4.3304, 'weight', 'displacement' ] );
    expect( +rt.predict( { weight: 'high weight', displacement: 'unk' } ).toFixed( 4 ) ).to.deep.equal( 20.5131 );
    // Missing column value without the handler - will throw error.
    expect( rt.predict.bind( null, { weight: 'high weight' } ) ).to.throw( 'winkRT: missing column value for the column found during prediction: "displacement"' );
  } );
} );


describe( 'Run basic edge cases', function () {
  it( 'should return JSON string, metrics with variance reduction of 0%, predict to throw error on no input', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: false },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true, exclude: true },
      { name: 'displacement', categorical: true, exclude: true },
      { name: 'horsepower', categorical: true, exclude: true },
      { name: 'weight', categorical: true, exclude: true },
      { name: 'acceleration', categorical: true, exclude: true },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: true  }
    ];
    rt.defineConfig( columns, { } );
    cars.forEach( function ( row ) {
      rt.ingest( row.split( ',' ) );
    } );
    rt.learn();
    cars.forEach( function ( row ) {
      var r = row.split( ',' );
      rt.evaluate( { model: r[0], mpg: r[1], cylinders: r[2], displacement: r[3], horsepower: r[4], weight: r[5], acceleration: r[6], year: r[7], origin: r[8] } );
    } );
    // console.log( rt.exportJSON() ); // eslint-disable-line no-console
    expect( typeof rt.exportJSON() ).to.equal( 'string' );
    expect( rt.metrics() ).to.deep.equal( { size: 394, varianceReduction: 0 } );
    // test no input to `predict()`
    expect( rt.predict.bind() ).to.throw( 'winkRT: input for prediction must be an object, instead found: undefined' );
  } );
} );

describe( 'Baisc import JSON cycle', function () {
  it( 'if the input is a null json', function () {
    var rt = wrt();
    // Import rules JSON
    expect( rt.importJSON( JSON.stringify( rules ) ) ).to.equal( true );
    // Confirm if it is being used correctly!
    expect( rt.summary() ).to.deep.equal( summary );
    expect( +( rt.predict( inp1 ) ).toFixed( 4 ) ).to.equal( 19.8533 );
  } );
} );


describe( 'Import of incorrect JSON must fail', function () {
  it( 'if the input is a null json', function () {
    var rt = wrt();
    expect( rt.importJSON.bind( null, null ) ).to.throw( 'winkRT: undefined or null JSON encountered, import failed!' );
  } );

  it( 'if the input is a empty json', function () {
    var rt = wrt();
    expect( rt.importJSON.bind( null, '' ) ).to.throw( 'winkRT: undefined or null JSON encountered, import failed!' );
  } );

  it( 'if the input is an ill-formed json', function () {
    var rt = wrt();
    expect( rt.importJSON.bind( null, '{ "junk": 3, }' ) ).to.throw( 'winkRT: JSON parsing error during import:\n\tUnexpected token } in JSON at position 13' );
  } );

  it( 'if the json version is wrong', function () {
    var rt = wrt();
    expect( rt.importJSON.bind( null, '{ "version": "1.3" }' ) ).to.throw( 'winkRT: incorrect json format or tree version, import failed!' );
  } );

  it( 'if the json version key is missing', function () {
    var rt = wrt();
    expect( rt.importJSON.bind( null, '{  }' ) ).to.throw( 'winkRT: incorrect json format or tree version, import failed!' );
  } );
} );

describe( 'Incorrect input to ingestion must fail', function () {
  it( 'if the input has less columns', function () {
    var columns = [
      { name: 'model', categorical: true, exclude: false },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true, exclude: true },
      { name: 'displacement', categorical: true, exclude: true },
      { name: 'horsepower', categorical: true, exclude: true },
      { name: 'weight', categorical: true, exclude: true },
      { name: 'acceleration', categorical: true, exclude: true },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: true  }
    ];
    var rt = wrt();
    rt.defineConfig( columns, { } );
    // Send less data
    expect( rt.ingest.bind( null, [ 'a', 'b' ] ) ).to.throw( 'winkRT: ingest is expecting 9 elements instead found: 2' );
    expect( rt.ingest.bind( null, [ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j' ] ) ).to.throw( 'winkRT: ingest is expecting 9 elements instead found: 10' );
  } );
} );

describe( 'Generate summary of learning', function () {
  it( 'should return object matching the summary.json', function () {
    var rt = wrt();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: false },
      { name: 'acceleration', categorical: true, exclude: false },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: false  }
    ];
    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 10, minSplitCandidateItems: 30, minAvgChildrenItems: 2 } );
    cars.forEach( function ( row ) {
      rt.ingest( row.split( ',' ) );
    } );
    rt.learn();
    expect( typeof rt.summary() ).to.equal( 'object' );
    // console.log( JSON.stringify( rt.summary(), null, 2 ) ); // eslint-disable-line no-console
    expect( rt.summary() ).to.deep.equal( summary );
  } );
} );

describe( 'Max Depth case during grow tree', function () {
  it( 'should return mean of 20.2855 for inp1 and overall variance reduction of 74.614%', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: false },
      { name: 'acceleration', categorical: true, exclude: false },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: false  }
    ];

    var f = function ( size, mean, stdev, cols, missingCol ) {
      return [ size, +mean.toFixed( 4 ), +stdev.toFixed( 4 ), cols.join( '/' ), missingCol ];
    };

    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 10, minSplitCandidateItems: 30, minAvgChildrenItems: 2, maxDepth: 2 } );
    cars.forEach( function ( row ) {
      rt.ingest( row.split( ',' ) );
    } );
    rt.learn();
    cars.forEach( function ( row ) {
      var r = row.split( ',' );
      rt.evaluate( { model: r[0], mpg: r[1], cylinders: r[2], displacement: r[3], horsepower: r[4], weight: r[5], acceleration: r[6], year: r[7], origin: r[8] } );
    } );
    // console.log( JSON.stringify( JSON.parse( rt.exportJSON() ), null, 2 ) ); // eslint-disable-line no-console
    expect( typeof rt.exportJSON() ).to.equal( 'string' );
    expect( rt.metrics() ).to.deep.equal( { size: 394, varianceReduction: 75.15 } );
    // Test with some real data.
    expect( +( rt.predict( inp1 ) ).toFixed( 4 ) ).to.equal( 20.2855 );
    // Note, since there are 2 levels - only 2 columns viz weight & displacement will be used.
    expect( rt.predict( inp1, f ) ).to.deep.equal( [ 69, 20.2855, 3.7278, 'weight/displacement', undefined ] );
  } );
} );


describe( 'No best column left case during grow tree', function () {
  it( 'should return mean of 20.2855 for inp1 and overall variance reduction of 62.7463%', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: false },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true },
      { name: 'displacement', categorical: true, exclude: true },
      { name: 'horsepower', categorical: true, exclude: true },
      { name: 'weight', categorical: true, exclude: true },
      { name: 'acceleration', categorical: true, exclude: true },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: true  }
    ];

    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 10, minSplitCandidateItems: 30, minAvgChildrenItems: 2 } );
    cars.forEach( function ( row ) {
      rt.ingest( row.split( ',' ) );
    } );
    rt.learn();
    cars.forEach( function ( row ) {
      var r = row.split( ',' );
      rt.evaluate( { model: r[0], mpg: r[1], cylinders: r[2], displacement: r[3], horsepower: r[4], weight: r[5], acceleration: r[6], year: r[7], origin: r[8] } );
    } );
    // console.log( JSON.stringify( JSON.parse( rt.exportJSON() ), null, 2 ) ); // eslint-disable-line no-console
    expect( typeof rt.exportJSON() ).to.equal( 'string' );
    expect( rt.metrics() ).to.deep.equal( { size: 394, varianceReduction: 62.7463 } );
  } );
} );

describe( 'Very small splits to test 0 stdev', function () {
  it( 'should return mean of 20.2855 for inp1 and overall variance reduction of 62.7463%', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true, exclude: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: true },
      { name: 'acceleration', categorical: true, exclude: true },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: true  }
    ];

    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 1, minSplitCandidateItems: 3, minAvgChildrenItems: 2 } );
    cars.forEach( function ( row ) {
      rt.ingest( row.split( ',' ) );
    } );
    rt.learn();
    cars.forEach( function ( row ) {
      var r = row.split( ',' );
      rt.evaluate( { model: r[0], mpg: r[1], cylinders: r[2], displacement: r[3], horsepower: r[4], weight: r[5], acceleration: r[6], year: r[7], origin: r[8] } );
    } );
    // console.log( JSON.stringify( JSON.parse( rt.exportJSON() ), null, 2 ) ); // eslint-disable-line no-console
    expect( typeof rt.exportJSON() ).to.equal( 'string' );
    expect( rt.metrics() ).to.deep.equal( { size: 394, varianceReduction: 74.3247 } );
  } );
} );

describe( 'Trying to learn with less data', function () {
  it( 'should throw if rows < 60', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true, exclude: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: true },
      { name: 'acceleration', categorical: true, exclude: true },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: true  }
    ];

    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 1, minSplitCandidateItems: 3, minAvgChildrenItems: 2 } );
    for ( var i = 0; i < 30; i += 1 ) {
      rt.ingest( cars[ i ].split( ',' ) );
    }
    // rt.learn();
    // console.log( JSON.stringify( JSON.parse( rt.exportJSON() ), null, 2 ) ); // eslint-disable-line no-console
    expect( rt.learn.bind( null ) ).to.throw( 'winkRT: learn is expecting at least 60 rows of data, instead found: 30' );
  } );
} );

describe( 'Trying to learn with constant Y', function () {
  it( 'should generate only 1 rule i.e. the root', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: false },
      { name: 'acceleration', categorical: true, exclude: false },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: false }
    ];

    var expectedRules = {
          rulesLearned: 0,
          version: 'WRT 1.0.0',
          size: 394,
          mean: 18,
          stdev: 0
        };

    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 10, minSplitCandidateItems: 30, minAvgChildrenItems: 2 } );
    cars.forEach( function ( row ) {
      var rowData = row.split( ',' );
      // Force constant mpg value i.e. constant Y case!
      rowData[ 1 ] = 18;
      rt.ingest( rowData );
    } );
    rt.learn();
    // console.log( JSON.stringify( JSON.parse( rt.exportJSON() ), null, 2 ) ); // eslint-disable-line no-console
    expect( JSON.parse( rt.exportJSON() ) ).to.deep.equal( expectedRules );
  } );
} );


describe( 'Trying to learn with constant Y under a node', function () {
  it( '*high weight* node should have stdev as 0 and no further branches', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: false },
      { name: 'acceleration', categorical: true, exclude: false },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: false }
    ];

    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 10, minSplitCandidateItems: 30, minAvgChildrenItems: 2 } );
    cars.forEach( function ( row ) {
      var rowData = row.split( ',' );
      // Force constant mpg value under *high weight* node!
      if ( rowData[ 5 ] === 'high weight' ) rowData[ 1 ] = 9;
      rt.ingest( rowData );
    } );
    rt.learn();
    // console.log( JSON.stringify( JSON.parse( rt.exportJSON() ), null, 2 ) ); // eslint-disable-line no-console
    expect( JSON.parse( rt.exportJSON() ).branches[ 'high weight' ].stdev ).to.equal( 0 );
    expect( JSON.parse( rt.exportJSON() ).branches[ 'high weight' ].branches ).to.equal( undefined );
  } );
} );

describe( 'Rules learned 0 case', function () {
  it( 'should return JSON string & metrics with variance reduction of 77.2636%', function () {
    var rt = wrt();
    // var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    // cars.pop();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: false },
      { name: 'acceleration', categorical: true, exclude: false },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: false  }
    ];

    // A value of 135 for `minAvgChildrenItems` ensures no best split candidate is found
    // at root level leading to rules learned being equal to 0.
    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 10, minSplitCandidateItems: 30, minAvgChildrenItems: 135 } );
    cars.forEach( function ( row ) {
      rt.ingest( row.split( ',' ) );
    } );

    // Test number of rules learned!
    expect( rt.learn() ).to.equal( 0 );
    // console.log( JSON.stringify( JSON.parse( rt.exportJSON() ), null, 2 ) ); // eslint-disable-line no-console
  } );
} );

describe( 'Run Reset Test Cycle with Quantized Car Data', function () {
  it( 'should return variance reduction of 70.6088%, 74.3369% & 71.8239%', function () {
    var rt = wrt();
    var columns = [
      { name: 'model', categorical: true, exclude: true },
      { name: 'mpg', categorical: false, target: true },
      { name: 'cylinders', categorical: true },
      { name: 'displacement', categorical: true, exclude: false },
      { name: 'horsepower', categorical: true, exclude: false },
      { name: 'weight', categorical: true, exclude: false },
      { name: 'acceleration', categorical: true, exclude: false },
      { name: 'year', categorical: true, exclude: true },
      { name: 'origin', categorical: true, exclude: false  }
    ];

    rt.defineConfig( columns, { minPercentVarianceReduction: 0.5, minLeafNodeItems: 10, minSplitCandidateItems: 30, minAvgChildrenItems: 2 } );

    var r;
    // Variance Reductions for each fold.
    var vrs = [ { size: 132, varianceReduction: 70.6088 }, { size: 131, varianceReduction: 74.3369 }, { size: 131, varianceReduction: 71.8239 } ];
    for ( var folds = 3, k = 0; k < folds; k += 1 ) {
      for ( var idx1 = 0; idx1 < cars.length; idx1 += 1 ) {
        if ( idx1 % folds !== 0 ) rt.ingest( cars[ idx1 ].split( ',' ) );
      }

      rt.learn();

      for ( var idx2 = 0; idx2 < cars.length; idx2 += 1 ) {
        r = cars[ idx2 ].split( ',' );
        if ( idx2 % folds === 0 ) rt.evaluate( { model: r[0], mpg: r[1], cylinders: r[2], displacement: r[3], horsepower: r[4], weight: r[5], acceleration: r[6], year: r[7], origin: r[8] } );
      }
      expect( rt.metrics() ).to.deep.equal( vrs[ k ] );

      // This ensures that each learning/validation set is unique under each fold.
      // Refer to the modulus operator in each for-loop.
      cars = cars.slice( 1 );
      rt.reset();
    }
  } );
} );
