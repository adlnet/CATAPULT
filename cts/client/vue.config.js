module.exports = {
    publicPath: "./",
    devServer: {
        port: 3396
    },
    css: {
        loaderOptions: {
            scss: {
                //
                // make all of our custom variables available in the style
                // blocks of all of the components without importing in each
                //
                prependData: `@import "~@/styles/custom-vars.scss";`
            }
        }
    }
};
