'use client'

import { Component, type ReactNode } from 'react'
import { resetAfterCrash, type ProfileStore } from '@/lib/mastery/profiles'

/**
 * Catches anything that throws during render so a child never meets a blank
 * page. The technical detail goes to the console for us; the child gets a
 * friendly screen and one obvious way out.
 *
 * Still a class component — React has no hook equivalent of componentDidCatch.
 */
export class SafeScreen extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Console only. Nothing is sent anywhere — the users are children.
    console.error('Endless Maths crashed:', error, info)
  }

  /**
   * Saved progress is the most likely culprit for a repeatable crash, so the
   * way out clears it. Losing history is recoverable; an app that crashes every
   * time it opens is not.
   *
   * It must clear the journey actually in use. Clearing a key nothing writes to
   * would leave the offending record in place and the reload would crash again
   * — an unbreakable loop, which is the one thing this component exists to
   * prevent.
   */
  private startAgain = () => {
    try {
      const store = window.localStorage as unknown as ProfileStore
      resetAfterCrash({
        getItem: (k) => store.getItem(k),
        setItem: (k, v) => store.setItem(k, v),
        removeItem: (k) => store.removeItem(k),
        keys: () => Object.keys(window.localStorage),
      })
    } catch {
      // Nothing useful to do; reloading is still worth a try.
    }
    window.location.reload()
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Something went wrong</h1>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
            Not your fault. Starting again will reset your saved progress.
          </p>
          <button
            type="button"
            onClick={this.startAgain}
            className="mt-8 h-14 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white
                       transition active:scale-95 hover:bg-emerald-700"
          >
            Start again
          </button>
        </div>
      </main>
    )
  }
}
