const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
module.exports = {
  mode: "production",
  entry: {
    tabsController: path.resolve(__dirname, "..", "src", "tabsController.ts"),
  },
  output: {
    path: path.join(__dirname, "../dist"),
    filename: "[name].js",
  },
  resolve: {
		alias: {
			'angular': path.resolve(__dirname, '../libraries/angular-1.8.2.min.js'),
		},
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
          loader: "ts-loader",
          exclude: /node_modules/,
      },
    ],
  }
};
