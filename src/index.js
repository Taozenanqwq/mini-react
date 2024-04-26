import { createElement, render, useState } from './source'

/** @jsxRuntime classic */
/** @jsx createElement */
function Counter() {
  const [state, setState] = useState(1)
  return (
    <h1 onClick={() => setState((c) => c + 1)}>Count: {state}</h1>
  )
}
const element = <Counter />
const root = document.getElementById('root')
render(element, root)
