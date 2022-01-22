module.exports = function (source, map) {
    this.cacheable();

    if (this.query.test && !this.query.test.test(source)) {
        return this.callback(null, source, map);
    }

    var header =
        typeof this.query.header === "function"
            ? this.query.header.call(this, source, map)
            : this.query.header;
    var footer =
        typeof this.query.footer === "function"
            ? this.query.footer.call(this, source, map)
            : this.query.footer;

    source = header + "\n" + source + "\n" + footer;

    this.callback(null, source, map);
};
