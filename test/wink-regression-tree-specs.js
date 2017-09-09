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

var expect = chai.expect;
var describe = mocha.describe;
var it = mocha.it;

describe( 'Instantiating Wink Regression Tree', function () {
  it( 'should return an object', function () {
    expect( typeof wrt( ) ).to.equal( 'object' );
  } );
} );
