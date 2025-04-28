const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './main.ts',
  devtool: 'inline-source-map',
  devServer: {
    static: {
      directory: path.join(__dirname, '../'), //  Serve content from the root
    },
    hot: true,
    open: true,
    port: 8080,
  },
  module: {
    rules: [
      { // Rule for TypeScript files
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    fallback: {
        "fs": false,
        "path": require.resolve("path-browserify")
    },
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, '../js'),
    publicPath: '/js/',
    clean: true,
  },
};