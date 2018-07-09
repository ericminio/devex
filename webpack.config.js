const glob = require('glob');
const path = require('path');
const webpack = require('webpack');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
    entry: {
        vendor: [
            'angular',
            'angular-animate',
            'angular-breadcrumb',
            'angular-messages',
            'angular-mocks',
            'angular-resource',
            'angular-ui-bootstrap',
            'angular-ui-notification',
            'angular-ui-router',
            'angular-ui-tinymce',
            'ng-img-crop',
            'ng-file-upload',
            'ng-idle',
            'angular-drag-and-drop-lists'
        ],
        appConfig: './modules/core/client/app/config.js',
        appInit: './modules/core/client/app/init.js',
        moduleConfig: glob.sync('./modules/*/client/*.js'),
        modules: glob.sync('./modules/*/client/**/*.js', {
            ignore: [   './modules/*/client/*.js',
                        './main.js',
                        './modules/core/client/app/config.js',
                        './modules/core/client/app/init.js'
                    ]
        })
    },
    output: {
        path: path.join(__dirname, './public/dist'),
        filename: '[name].bundle.js'
    },
    resolve: {
        mainFiles: ['index', 'compile/minified/ng-img-crop']
    },
    optimization: {
        splitChunks: {
            chunks: 'all'
        }
    },
    plugins:
        [
            new BundleAnalyzerPlugin()
        ]
}