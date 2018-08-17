const glob = require('glob');
const path = require('path');

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
        minimize: true
    },
    module: {
        rules: [
            {
                test: require.resolve('tinymce/tinymce'),
                use: [
                    'imports-loader?this=>window',
                    'exports-loader?window.tinymce'
                ]
            },
            {
                test: /tinymce\/(themes|plugins)\//,
                use: [
                    'imports-loader?this=>window'
                ]
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader', 'css-loader'
                ]
            },
            {
                test: /\.(svg|woff|woff2|ttf|eot|otf|png|jpe?g|gif|ico)(\?v=[a-z0-9]\.[a-z0-9]\.[a-z0-9])?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[path][name].[ext]'
                        }
                    }]
            }
        ]
    }
}