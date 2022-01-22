module.exports = function (source, map) {
    this.cacheable();

    if (this.query.test && !this.query.test.test(source)) {
        return this.callback(null, source, map);
    }

    const replacements = this.query.replacements;

    let newSource = source;
    for (let i = 0; i < replacements.length; i++) {
        const replace = replacements[i];
        newSource = newSource.replace(replace.pattern, replace.replacement.bind(this));
    }

    this.callback(null, newSource, map);
};
