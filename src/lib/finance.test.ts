import assert from "node:assert/strict";
import test from "node:test";
import { budgetStatus, currencySymbol, getCycle, toDateKey } from "./finance.ts";

test("budget thresholds",()=>{assert.equal(budgetStatus(799,1000),"safe");assert.equal(budgetStatus(800,1000),"warning");assert.equal(budgetStatus(1000,1000),"over")});
test("cycle before payday",()=>{const c=getCycle(25,new Date(2026,8,15,12));assert.equal(toDateKey(c.start),"2026-08-25");assert.equal(toDateKey(c.end),"2026-09-24")});
test("currency fallback",()=>{assert.equal(currencySymbol("INR"),"₹");assert.equal(currencySymbol("XYZ"),"XYZ")});
