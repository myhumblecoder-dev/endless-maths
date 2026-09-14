import { App } from '@/components/App'
import { SafeScreen } from '@/components/SafeScreen'

export default function Home() {
  return (
    <SafeScreen>
      <App />
    </SafeScreen>
  )
}
