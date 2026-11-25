import test from "node:test";
import assert from "node:assert/strict";
import { createDispatchRunner } from "../server/lib/dispatch-runner.mjs";
test("slow push delivery never blocks dispatch ticks and only one push drain runs", async () => {
  let dispatches = 0,
    pushes = 0,
    release;
  const pushPending = new Promise((resolve) => {
    release = resolve;
  });
  const runner = createDispatchRunner({
    dispatch: async () => {
      dispatches++;
      return { nextDueAt: Date.now() + 90000 };
    },
    push: async () => {
      pushes++;
      await pushPending;
    },
  });
  await runner.run();
  await runner.run();
  assert.equal(dispatches, 2);
  assert.equal(pushes, 1);
  assert.equal(runner.active(), true);
  release();
});

test('a payment wake arriving during an idle check is processed before the runner goes idle',async()=>{
 let release,calls=0;const pending=new Promise(resolve=>{release=resolve;});
 const runner=createDispatchRunner({dispatch:async()=>{calls++;return calls===1?pending:{nextDueAt:Date.now()+90000}},push:async()=>{}});
 const started=runner.run();runner.wake();release({nextDueAt:null});await started;assert.equal(calls,2);assert.equal(runner.active(),true);
});
test('an overdue next record keeps the fast timer active',async()=>{
 const runner=createDispatchRunner({dispatch:async()=>({nextDueAt:Date.now()-90000}),push:async()=>{}});await runner.run();assert.equal(runner.active(),true);
});
