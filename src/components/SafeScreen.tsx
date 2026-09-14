'use client'

import { Component, type ReactNode } from 'react'
import { STORAGE_KEY } from '@/lib/mastery/storage'

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
   */
  private startAgain = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
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
          <p className="text-7xl" aria-hidden>🤔</p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">Oops!</h1>
          <p className="mt-2 text-xl text-slate-600 dark:text-slate-300">
            Something went wrong. That&apos;s not your fault.
          </p>
          <button
            type="button"
            onClick={this.startAgain}
            className="mt-8 h-16 w-full rounded-2xl bg-emerald-500 text-2xl font-bold text-white
                       transition active:scale-95 hover:bg-emerald-600"
          >
            Start again
          </button>
        </div>
      </main>
    )
  }
}
