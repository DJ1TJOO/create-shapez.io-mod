module.exports = function (source, map) {
    this.cacheable();

    var header = typeof this.query.header === "function" ? this.query.header(source, map) : this.query.header;
    var footer = typeof this.query.footer === "function" ? this.query.footer(source, map) : this.query.footer;

    source = header + "\n" + source + "\n" + footer;

    this.callback(null, source, map);
};
