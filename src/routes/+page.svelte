<script lang="ts">
    import { goto } from "$app/navigation";
    import { auth } from "$lib/auth.svelte";

    $effect(() => {
        if (!auth.loading && auth.isLoggedIn) {
            goto("/cards", { replaceState: true });
        }
    });
</script>

{#if !auth.loading && !auth.isLoggedIn}
    <div class="landing">
        <header class="nav">
            <div class="brand">SembleIt</div>
            <a class="nav-link" href="/login">Login</a>
        </header>

        <section class="hero">
            <div class="hero-copy">
                <h1>A fast, local-first client for semble.</h1>
                <p class="lede">
                    SembleIt is a snappy, offline-capable client for
                    <a href="https://semble.so" target="_blank" rel="noopener">semble</a>
                </p>
                <div class="cta-row">
                    <a class="cta-primary" href="/login">Login</a>
                    <a
                        class="cta-secondary"
                        href="https://github.com/disnet/semble-it"
                        target="_blank"
                        rel="noopener"
                    >
                        View source
                    </a>
                </div>
                <p class="note">Free. Open source. No tracking.</p>
            </div>

            <div class="hero-visual">
                <img
                    class="screenshot"
                    src="/screenshot.jpeg"
                    alt="SembleIt showing a list of saved cards on mobile"
                    width="390"
                    loading="eager"
                />
            </div>
        </section>

        <section class="features">
            <div class="feature">
                <div class="feature-icon">⚡</div>
                <h3>Instantly fast</h3>
                <p>
                    Local-first. Cards load and filter from your device — no waiting on
                    the network.
                </p>
            </div>
            <div class="feature">
                <div class="feature-icon">📶</div>
                <h3>Works offline</h3>
                <p>
                    Browse, edit, and add cards offline. Changes sync to semble when
                    you're back online.
                </p>
            </div>
            <div class="feature">
                <div class="feature-icon">🪪</div>
                <h3>Your data, your PDS</h3>
                <p>
                    Signs in with AT Protocol. Cards live on your PDS — portable by
                    default.
                </p>
            </div>
        </section>

        <footer class="footer">
            <span>© SembleIt</span>
            <a href="/login">Login</a>
        </footer>
    </div>
{/if}

<style>
    .landing {
        min-height: 100dvh;
        background:
            radial-gradient(
                1200px 600px at 80% -10%,
                var(--color-primary-light),
                transparent 60%
            ),
            radial-gradient(900px 500px at -10% 10%, #f5f3ff, transparent 60%),
            var(--color-bg);
        display: flex;
        flex-direction: column;
    }

    .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-lg) var(--space-xl);
        max-width: 1100px;
        width: 100%;
        margin: 0 auto;
    }

    .brand {
        font-weight: 700;
        font-size: 1.125rem;
        color: var(--color-primary);
    }

    .nav-link {
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-text);
    }

    .hero {
        flex: 1;
        max-width: 1100px;
        width: 100%;
        margin: 0 auto;
        padding: var(--space-xl);
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: var(--space-xl);
        align-items: center;
    }

    .hero-copy h1 {
        font-size: clamp(2rem, 5vw, 3.25rem);
        line-height: 1.1;
        letter-spacing: -0.02em;
        margin-bottom: var(--space-md);
    }

    .lede {
        font-size: 1.0625rem;
        line-height: 1.55;
        color: var(--color-text-secondary);
        margin-bottom: var(--space-lg);
        max-width: 48ch;
    }

    .cta-row {
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
    }

    .cta-primary {
        display: inline-flex;
        align-items: center;
        padding: 14px 22px;
        background: var(--color-primary);
        color: #fff;
        border-radius: var(--radius-md);
        font-weight: 600;
        box-shadow: var(--shadow-md);
        transition:
            background 0.15s,
            transform 0.15s;
    }

    .cta-primary:hover {
        background: var(--color-primary-hover);
        transform: translateY(-1px);
    }

    .cta-secondary {
        display: inline-flex;
        align-items: center;
        padding: 14px 22px;
        background: var(--color-surface);
        color: var(--color-text);
        border-radius: var(--radius-md);
        font-weight: 600;
        border: 1px solid var(--color-border);
    }

    .note {
        margin-top: var(--space-md);
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
    }

    .hero-visual {
        display: flex;
        justify-content: center;
    }

    .screenshot {
        width: 280px;
        max-width: 100%;
        height: auto;
        border-radius: 24px;
        box-shadow: var(--shadow-lg);
        border: 1px solid var(--color-border);
        transform: rotate(-2deg);
        background: var(--color-surface);
    }

    .features {
        max-width: 1100px;
        width: 100%;
        margin: 0 auto;
        padding: var(--space-xl);
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-lg);
    }

    .feature {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
    }

    .feature-icon {
        font-size: 1.5rem;
        margin-bottom: var(--space-sm);
    }

    .feature h3 {
        font-size: 1rem;
        margin-bottom: var(--space-xs);
    }

    .feature p {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
    }

    .footer {
        max-width: 1100px;
        width: 100%;
        margin: 0 auto;
        padding: var(--space-lg) var(--space-xl);
        display: flex;
        justify-content: space-between;
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
    }

    .footer a {
        color: var(--color-text-secondary);
    }

    @media (max-width: 800px) {
        .hero {
            grid-template-columns: 1fr;
            text-align: center;
            padding: var(--space-lg);
        }

        .lede {
            margin-left: auto;
            margin-right: auto;
        }

        .cta-row {
            justify-content: center;
        }

        .hero-visual {
            order: -1;
        }

        .screenshot {
            width: 240px;
            transform: rotate(0);
        }

        .features {
            grid-template-columns: 1fr;
            padding: var(--space-lg);
        }
    }
</style>
