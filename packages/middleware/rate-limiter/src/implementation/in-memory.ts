import { Slot, SlotProvider } from '../slot'

class InMemorySlot implements Slot {
  readonly fromSecond: number
  private counter: number

  constructor(fromSecond: number) {
    this.counter = 0
    this.fromSecond = fromSecond
  }

  inc(): void {
    this.counter++
  }

  value(): number {
    return this.counter
  }
}

export class InMemorySlotProvider implements SlotProvider {
  create({ fromSecond }: { fromSecond: number }): Slot {
    return new InMemorySlot(fromSecond)
  }
}
