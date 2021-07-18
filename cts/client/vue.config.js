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
                additionalData: `@import "~@/styles/custom-vars.scss";`
            }
        }
    },
    chainWebpack: (config) => {
        config.plugin("html").tap(
            (args) => {
                args[0].title = "Catapult: CTS"

                return args;
            }
        );
    }
};
