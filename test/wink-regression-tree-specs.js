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


//
var chai = require( 'chai' );
var mocha = require( 'mocha' );
var wrt = require( '../src/wink-regression-tree.js' );
var fs = require( 'fs' );

var expect = chai.expect;
var describe = mocha.describe;
var it = mocha.it;

describe( 'Instantiating Wink Regression Tree', function () {
  it( 'should return an object', function () {
    expect( typeof wrt() ).to.equal( 'object' );
  } );
} );


describe( 'Run Basic Test Cycle with Quantized Car Data', function () {
  it( 'should return JSON string & metrics with variance reduction of 75.6893%', function () {
    var rt = wrt();
    var cars = fs.readFileSync( './test/data/cars-quantized-data.csv', 'utf-8' ).split( '\n' ); // eslint-disable-line no-sync
    cars.pop();
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
    cars.forEach( function ( row ) {
      var r = row.split( ',' );
      rt.evaluate( { model: r[0], mpg: r[1], cylinders: r[2], displacement: r[3], horsepower: r[4], weight: r[5], acceleration: r[6], year: r[7], origin: r[8] } );
    } );
    // console.log( rt.exportJSON() ); // eslint-disable-line no-console
    expect( typeof rt.exportJSON() ).to.equal( 'string' );
    expect( rt.metrics() ).to.deep.equal( { size: 394, varianceReduction: 75.6893 } );
  } );
} );
