// =============================  PersistedToggle.js  ============================= //
// Shared boilerplate for Theme.js / FontSize.js / TabFocus.js / Settings.js:
// a localStorage get/set wrapper that never throws, and the poll-until-mounted
// boot loop each of them used to duplicate (the nav bar they mount into is
// built asynchronously by QueueView, so mounting is retried on a timer).
// Extracted from four near-identical copies -- behavior is unchanged.

const PersistedToggle = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, v) { try { localStorage.setItem(key, v); } catch (e) {} },

    // Retries mountFn() every 50ms (up to 3s) until it both returns truthy
    // and doneSelector is present in the DOM, then stops.
    pollMount(mountFn, doneSelector) {
        let tries = 0;
        const timer = setInterval(() => {
            if (mountFn() && document.querySelector(doneSelector)) clearInterval(timer);
            if (++tries > 60) clearInterval(timer);
        }, 50);
    }
};

if (typeof window !== 'undefined') window.PersistedToggle = PersistedToggle;
