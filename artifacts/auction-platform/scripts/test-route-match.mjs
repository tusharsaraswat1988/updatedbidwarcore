import { matchRoute } from "../node_modules/wouter/src/index.js";
import { parse } from "../../node_modules/.pnpm/regexparam@3.0.0/node_modules/regexparam/index.js";

const path = "/tournament/5/teams";
console.log("hub match:", matchRoute(parse, "/tournament/:id", path));
console.log("teams match:", matchRoute(parse, "/tournament/:id/teams", path));
