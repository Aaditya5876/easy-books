"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adToBs = adToBs;
exports.bsToAd = bsToAd;
exports.todayBs = todayBs;
const nepali_date_converter_1 = require("nepali-date-converter");
function adToBs(adDate) {
    const nd = new nepali_date_converter_1.default(adDate);
    const year = nd.getYear();
    const month = nd.getMonth() + 1;
    const day = nd.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function bsToAd(bsDate) {
    return new nepali_date_converter_1.default(bsDate).toJsDate();
}
function todayBs() {
    return adToBs(new Date());
}
//# sourceMappingURL=nepali-date.js.map