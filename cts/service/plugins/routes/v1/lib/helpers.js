module.exports = {
    doesLRSResourceEnforceConcurrency: (resourcePath) => {
        const concurrencyPaths = [
            "activities/state",
            "activities/profile",
            "agents/profile"
        ];

        return concurrencyPaths.includes(resourcePath);
    }
}