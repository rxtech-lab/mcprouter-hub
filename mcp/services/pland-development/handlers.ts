import { request, response } from "./spatial";
import contracts from "./contracts.json";

export const request33611 = request(contracts["3361-1"]);
export const response33611 = response(contracts["3361-1"]);
export const request3362 = request(contracts["3362"]);
export const response3362 = response(contracts["3362"]);
export const request3366 = request(contracts["3366"]);
export const response3366 = response(contracts["3366"]);
export const request3369 = request(contracts["3369"]);
export const response3369 = response(contracts["3369"]);
export const request36160 = request(contracts["3616-0"]);
export const response36160 = response(contracts["3616-0"]);
export const request3617 = request(contracts["3617"]);
export const response3617 = response(contracts["3617"]);
export const request3618 = request(contracts["3618"]);
export const response3618 = response(contracts["3618"]);
export const request36210 = request(contracts["3621-0"]);
export const response36210 = response(contracts["3621-0"]);
export const request36211 = request(contracts["3621-1"]);
export const response36211 = response(contracts["3621-1"]);
export const request36212 = request(contracts["3621-2"]);
export const response36212 = response(contracts["3621-2"]);
export const request36213 = request(contracts["3621-3"]);
export const response36213 = response(contracts["3621-3"]);

import { raster as readRaster } from "./raster";
export const raster = readRaster;
