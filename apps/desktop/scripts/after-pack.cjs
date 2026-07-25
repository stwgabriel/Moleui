// electron-builder afterPack orchestrator. Icon embedding must run before the
// ad-hoc sign so the added Assets.car is covered by the sealed resources.

const embedAppIcon = require("./embed-appicon.cjs");
const adhocSign = require("./adhoc-sign.cjs");

exports.default = async function afterPack(context) {
  await embedAppIcon.default(context);
  await adhocSign.default(context);
};
