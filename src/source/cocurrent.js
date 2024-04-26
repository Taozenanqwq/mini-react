import { createDom } from './dom'
let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deleteions = []
let wipFiber = null
let hookIndex = null
// 进行循环工作的主要逻辑
function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    // 2.performUnitOfWork是我们执行工作单元的主要逻辑，他完成后会根据寻找的逻辑返回下一个工作单元
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    // 3.deadline是requestIdleCallback回调给到的参数，在这里我们用它来检测是否还有剩余时间
    shouldYield = deadline.timeRemaining() < 1
  }
  if (!nextUnitOfWork && wipRoot) commitRoot()
  // 4.没有可操作的工作单元或者剩余时间不足时则会再次设置回调，等待下一次浏览器的调用
  requestIdleCallback(workLoop)
}
// 1. 设置通知的回调函数
requestIdleCallback(workLoop)

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null
  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    const sameFiber = oldFiber && oldFiber.type === element.type
    let newFiber
    if (sameFiber) {
      //更新
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE'
      }
    }
    if (element && !sameFiber) {
      //新增
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT'
      }
    }
    if (oldFiber && !sameFiber) {
      //删除
      oldFiber.effectTag = 'DELETION'
      deleteions.push(oldFiber)
    }
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }
    if (newFiber) {
      if (index == 0) {
        wipFiber.child = newFiber
      } else {
        prevSibling.sibling = newFiber
      }
      prevSibling = newFiber
      index++
    }
  }
}
// 处理工作单元的方法
function performUnitOfWork(fiber) {
  const isFC = fiber.type instanceof Function
  if (isFC) {
    updateFunctionComponent(fiber)
    const { type, props } = fiber
    Object.assign(fiber, type(props))
    const { type: domType } = fiber
    fiber.type = type
    fiber.domType = domType
  }
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
  // 如果有子fiber则返回子fiber
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    // 如果有兄弟fiber则返回兄弟fiber
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    // 当再也没有兄弟fiber时，返回父fiber的兄弟fiber，然后重复
    nextFiber = nextFiber.parent
  }
  return nextFiber
}

export const render = (element, container) => {
  wipRoot = {
    dom: container,
    parent: {
      dom: container.parentNode
    },
    props: {
      children: [element]
    },
    alternative: currentRoot
  }
  deleteions = []
  nextUnitOfWork = wipRoot
}

function commitRoot() {
  // TODO 把节点添加进dom
  deleteions.forEach(commitWork)
  commitWork(wipRoot)
  currentRoot = wipRoot
  wipRoot = null
}

// 是否为事件
const isEvent = (key) => key.startsWith('on')
// 检查是否为有效的props
const isProperty = (key) => key !== 'children' && !isEvent(key)
// 是否为新的props
const isNew = (prev, next) => (key) => prev[key] !== next[key]
// 在新的props中他是否被去掉了
const isGone = (prev, next) => (key) => !(key in next)
function updateDom(dom, prevProps, nextProps) {
  // 移除掉旧的监听事件
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(
      (key) => !(key in nextProps) || isNew(prevProps, nextProps)(key)
    )
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  // 删除掉旧的props
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = ''
    })

  // 增加新的props与修改原有的props
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name]
    })

  // 增加新的监听事件
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

function commitWork(fiber) {
  if (!fiber) {
    return
  }
  const domParent = fiber.parent.dom
  // 替换操作
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent.appendChild(fiber.dom)
    // 更新操作
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
    // 更新dom时我们需要传入旧的props，去进行props的对比
    console.log(fiber)
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    // 删除操作
  } else if (fiber.effectTag === 'DELETION') {
    fiber.parent.removeChild(fiber.dom)
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

export function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
}

export function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: []
  }
  const actions = oldHook ? oldHook.queue : []
  actions.forEach((action) => {
    hook.state = action(hook.state)
  })
  wipFiber.hooks.push(hook)
  hookIndex++
  return [
    hook.state,
    (action) => {
      hook.queue.push(action)
      wipRoot = {
        dom: currentRoot.dom,
        props: currentRoot.props,
        alternate: currentRoot,
        parent: currentRoot.parent
      }
      nextUnitOfWork = wipRoot
    }
  ]
}
