// Changes every build; used to cache-bust the admin bundle URL so deploys
// are visible without a hard refresh.
module.exports = () => Date.now().toString(36);
