// Routing never waits for notification transport. The minute watchdog checks an
// idle server; payment events wake the fast clock while deadlines remain.
export function createDispatchRunner(jobs, { onError = () => {} } = {}) {
  let routing = false,
    pushing = false,
    activeUntil = 0,
    rerun = false;
  function drain() {
    if (pushing) return;
    pushing = true;
    void jobs
      .push()
      .catch(onError)
      .finally(() => {
        pushing = false;
      });
  }
  async function run() {
    if (routing) {
      rerun = true;
      return;
    }
    routing = true;
    let result;
    try {
      do {
        rerun = false;
        result = await jobs.dispatch();
        activeUntil = result.nextDueAt
          ? Math.max(Date.now() + 5000, result.nextDueAt + 5000)
          : 0;
        drain();
      } while (rerun);
      return result;
    } catch (error) {
      activeUntil = Math.max(activeUntil, Date.now() + 10000);
      onError(error);
    } finally {
      routing = false;
    }
  }
  return {
    run,
    active: () => activeUntil > Date.now(),
    wake: () => {
      activeUntil = Date.now() + 180000;
      void run();
    },
  };
}
