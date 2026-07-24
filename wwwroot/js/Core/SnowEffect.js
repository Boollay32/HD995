/**
 * SnowEffect.js
 * Modern Christmas snow effect with depth layers
 * Version: 2.0
 */

class SnowEffect {
    constructor(options = {}) {
        this.options = {
            enabled: options.enabled !== false,
            snowflakeCount: options.snowflakeCount || 50,
            startDate: options.startDate || '12-01',
            endDate: options.endDate || '01-07',
            navbarOnly: options.navbarOnly || false, // Snow only over navbar
            ...options
        };

        this.snowContainer = null;
        this.snowflakes = [];

        if (this.shouldShowSnow()) {
            this.init();
        }
    }

    shouldShowSnow() {
        if (!this.options.enabled) return false;

        const now = new Date();
        const currentYear = now.getFullYear();

        const [startMonth, startDay] = this.options.startDate.split('-').map(Number);
        const [endMonth, endDay] = this.options.endDate.split('-').map(Number);

        const startDate = new Date(currentYear, startMonth - 1, startDay);
        let endDate = new Date(currentYear, endMonth - 1, endDay);

        if (endMonth === 1) {
            endDate = new Date(currentYear + 1, endMonth - 1, endDay);
        }

        return now >= startDate && now <= endDate;
    }

    init() {
        this.createSnowContainer();
        this.createSnowflakes();
        // Navbar mode: motion is frame-driven, not CSS-animated. CSS top/
        // margin animations pixel-snap (jagged), and transform animations
        // freeze under software rendering; a JS-set transform each frame
        // repaints on the main thread with sub-pixel smoothness everywhere.
        this._startLoop();   // both modes: the CSS full-page fall is retired
    }

    _startLoop() {
        // Mode-tuned: the navbar is a 56px window; full-page (login) falls
        // the viewport, slower relative to its height and with lower opacity
        // ceilings so a whole screen of snow still reads as subtle.
        const nav = this.options.navbarOnly;
        const SPEED = nav ? { near: 12, medium: 8.5, far: 5.5 }
                          : { near: 26, medium: 18,  far: 12 };   // px/s fall
        const MAXO  = nav ? { near: 0.95, medium: 0.8,  far: 0.6 }
                          : { near: 0.85, medium: 0.65, far: 0.45 };
        const LEAD = nav ? 8 : 10;             // spawn height above the frame
        const H = nav ? 56 : Math.max(400, window.innerHeight || 800);
        const TRAVEL = nav ? 62 : H + 2 * LEAD;
        const FADE_IN_END    = nav ? 10 : 24;
        const FADE_OUT_START = nav ? 38 : H - 70;
        const FADE_OUT_END   = nav ? 52 : H - 20;

        this._flakeState = this.snowflakes.map(el => {
            const depth = el.classList.contains('near') ? 'near'
                        : el.classList.contains('medium') ? 'medium' : 'far';
            el.style.opacity = '0';                 // no first-frame flash
            return {
                el,
                speed: SPEED[depth] * (0.85 + Math.random() * 0.3),
                phase: Math.random() * TRAVEL,
                drift: nav ? 0.9 + Math.random() * 0.7
                           : 4 + Math.random() * 3,   // px/s rightward wind
                swayAmp: nav ? 0.8 + Math.random() * 1.2
                             : 1.2 + Math.random() * 2,
                swayHz: 0.15 + Math.random() * 0.2,
                swayOff: Math.random() * 6.283,
                max: MAXO[depth]
            };
        });

        this._t0 = null;
        const tick = (ts) => {
            if (!this.snowContainer) return;        // stopped mid-flight
            if (this._t0 === null) this._t0 = ts;
            const t = (ts - this._t0) / 1000;
            for (const f of this._flakeState) {
                const cyc = (t * f.speed + f.phase) % TRAVEL;
                const y = cyc - LEAD;
                // Wind: steady rightward drift over this fall's elapsed time
                // plus a faint sway; resets with the cycle while opacity is 0.
                const x = (cyc / f.speed) * f.drift
                        + Math.sin(t * f.swayHz * 6.283 + f.swayOff) * f.swayAmp;
                let o;
                if (y < FADE_IN_END) o = Math.max(0, (y + LEAD) / (FADE_IN_END + LEAD));
                else if (y > FADE_OUT_START) o = Math.max(0, 1 - (y - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START));
                else o = 1;
                f.el.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
                f.el.style.opacity = (o * f.max).toFixed(3);
            }
            this._raf = requestAnimationFrame(tick);
        };
        this._raf = requestAnimationFrame(tick);
    }

    _stopLoop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        this._t0 = null;
        this._flakeState = null;
    }

    createSnowContainer() {
        // Remove any prior container of either flavour - re-init previously
        // left an old #navbar-snow in place and doubled the flakes.
        document.getElementById('snow-overlay')?.remove();
        document.getElementById('navbar-snow')?.remove();

        this.snowContainer = document.createElement('div');
        this.snowContainer.id = this.options.navbarOnly ? 'navbar-snow' : 'snow-overlay';

        document.body.appendChild(this.snowContainer);
    }

    createSnowflakes() {
        for (let i = 0; i < this.options.snowflakeCount; i++) {
            const snowflake = this.createSnowflake();
            this.snowflakes.push(snowflake);
            this.snowContainer.appendChild(snowflake);
        }
    }

    createSnowflake() {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';

        // Random depth layer
        const depthRandom = Math.random();
        let depthClass, sizeClass;

        if (depthRandom < 0.3) {
            depthClass = 'near';
            sizeClass = 'size-large';
        } else if (depthRandom < 0.7) {
            depthClass = 'medium';
            sizeClass = 'size-medium';
        } else {
            depthClass = 'far';
            sizeClass = 'size-small';
        }

        snowflake.classList.add(depthClass, sizeClass);

        // Add sparkle to some snowflakes
        if (Math.random() < 0.2) {
            snowflake.classList.add('sparkle');
        }

        // Random horizontal position
        const startX = Math.random() * 100;
        snowflake.style.left = `${startX}%`;

        // Random animation delay for staggered effect
        const delay = Math.random() * 5;
        snowflake.style.animationDelay = `${delay}s`;

        return snowflake;
    }

    stop() {
        this._stopLoop();
        if (this.snowContainer) {
            this.snowContainer.remove();
            this.snowContainer = null;
            this.snowflakes = [];
        }
    }

    toggle() {
        if (this.snowContainer) {
            this.stop();
        } else {
            this.init();
        }
    }
}

if (typeof window !== 'undefined') {
    window.SnowEffect = SnowEffect;
}
