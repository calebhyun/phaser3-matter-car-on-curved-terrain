interface DynamicTextures {
  x1: number
  x2: number
  type: 'TileSprite' | 'Graphics' | 'Image' | 'Sprite'
  texture:
    | Phaser.GameObjects.TileSprite
    | Phaser.GameObjects.Graphics
    | Phaser.GameObjects.Image
    | Phaser.GameObjects.Sprite
}

interface StockData {
  [date: string]: {
    '4. close': string;  // We'll only use closing prices for simplicity
  }
}

export default class Terrain {
  private dynamicTextures: DynamicTextures[] = []
  private _scene: Phaser.Scene

  // Sample historical AAPL data from 2023 (you can modify this)
  private historicalData: StockData = {
    '2023-01-03': { '4. close': '125.07' },
    '2023-01-04': { '4. close': '126.36' },
    '2023-01-05': { '4. close': '127.12' },
    '2023-01-06': { '4. close': '129.62' },
    '2023-01-09': { '4. close': '130.15' },
    '2023-01-10': { '4. close': '130.73' },
    '2023-01-11': { '4. close': '133.49' },
    '2023-01-12': { '4. close': '133.41' },
    '2023-01-13': { '4. close': '134.76' },
    '2023-01-17': { '4. close': '135.94' },
    '2023-01-18': { '4. close': '135.21' },
    '2023-01-19': { '4. close': '135.27' },
    '2023-01-20': { '4. close': '137.87' },
    '2023-01-23': { '4. close': '141.11' },
    '2023-01-24': { '4. close': '142.53' },
    '2023-01-25': { '4. close': '141.86' },
    '2023-01-26': { '4. close': '143.96' },
    '2023-01-27': { '4. close': '145.93' },
    '2023-01-30': { '4. close': '143.00' },
    '2023-01-31': { '4. close': '144.29' }
  }

  private generatePathFromStockData(): string {
    const entries = Object.entries(this.historicalData)
    console.log('Processing stock entries:', {
        count: entries.length,
        firstDate: entries[0][0],
        lastDate: entries[entries.length - 1][0]
    });

    // Calculate price range for scaling
    const prices = entries.map(([_, values]) => parseFloat(values['4. close']))
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice

    console.log('Price range:', { minPrice, maxPrice, priceRange });

    // Generate path commands
    let pathCommands = []
    const SCALE_X = 100  // Increased spacing between points
    const BASE_Y = 600   // Base height
    const HEIGHT_SCALE = 3  // Increased height variation

    entries.forEach(([date, values], index) => {
        const price = parseFloat(values['4. close'])
        const x = index * SCALE_X
        // Invert Y coordinate (higher prices = higher terrain)
        const y = BASE_Y - ((price - minPrice) / priceRange * HEIGHT_SCALE * 300)
        
        if (index === 0) {
            pathCommands.push(`M ${x},${y}`)
        } else {
            pathCommands.push(`L ${x},${y}`)
        }
    });

    // Close the path
    const lastX = (entries.length - 1) * SCALE_X
    pathCommands.push(`L ${lastX},${BASE_Y + 200}`)  // Bottom right
    pathCommands.push(`L 0,${BASE_Y + 200}`)         // Bottom left
    pathCommands.push('Z')  // Close path

    const finalPath = pathCommands.join(' ')
    console.log('Generated path:', {
        commandCount: pathCommands.length,
        firstCommand: pathCommands[0],
        lastCommand: pathCommands[pathCommands.length - 2]
    });

    return finalPath
  }

  constructor(scene: Phaser.Scene, path: any, x: number, y: number, terrainIndex?: number) {
    this._scene = scene
    console.log('Starting terrain construction...', { x, y, terrainIndex });

    const stockPath = this.generatePathFromStockData()
    this.initializeTerrain(stockPath, x, y, terrainIndex)
  }

  private initializeTerrain(path: string, x: number, y: number, terrainIndex?: number) {
    // @ts-ignore
    const Matter = Phaser.Physics.Matter.Matter

    let pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    pathElement.setAttributeNS(null, 'd', path)
    pathElement.setAttributeNS(null, 'id', 'path3780')

    var vertexSets: { x: number; y: number }[][] = []
    vertexSets.push(Matter.Svg.pathToVertices(pathElement, 30))

    const minMax = (items: number[]) => {
        return items.reduce(
            (acc, val) => {
                acc.high = isNaN(acc.high) || val > acc.high ? val : acc.high
                acc.low = isNaN(acc.low) || val < acc.low ? val : acc.low
                return acc
            },
            { high: NaN, low: NaN }
        )
    }

    let points = {
        x: minMax(vertexSets[0].map(point => point.x)),
        y: minMax(vertexSets[0].map(point => point.y))
    }

    const normalizeVertices = (vertices: { x: number; y: number }[]) => {
        return vertices.map(point => {
            return { x: point.x - points.x.low, y: point.y - points.y.low }
        })
    }

    vertexSets[0] = normalizeVertices(vertexSets[0])

    let PADDING = 200
    let LINE_HEIGHT = 25
    let WIDTH = points.x.high - points.x.low
    let HEIGHT = points.y.high - points.y.low

    // Create the terrain using this._scene instead of scene
    let terrain = this._scene.add.graphics({ x: x, y: y })
    terrain.fillStyle(0x685339)
    terrain.beginPath()
    vertexSets[0].forEach(c => {
        terrain.lineTo(Math.round(c.x), Math.round(c.y))
    })
    terrain.closePath()
    terrain.fillPath()

    const mask = terrain.createGeometryMask()

    // Create the holes using this._scene
    for (let i = 0; i < Math.ceil(WIDTH / 1024); i++) {
        let xx = x + i * 1024
        let wholes = this._scene.add.tileSprite(xx, y, 512, HEIGHT, 'atlas', 'wholes-small')
        wholes.setOrigin(0)
        wholes.setScale(2, 2)
        wholes.setMask(mask)
        this.dynamicTextures.push({ x1: xx, x2: xx + 1024, texture: wholes, type: 'TileSprite' })
    }

    // Create grass using this._scene
    let grass = this._scene.add.graphics({ x: x, y: y })
    grass.lineStyle(LINE_HEIGHT, 0xadea53)
    grass.beginPath()
    vertexSets[0].forEach(c => {
        grass.lineTo(Math.round(c.x), Math.round(c.y))
    })
    grass.strokePath()

    // Plant grass sprites using this._scene
    vertexSets[0].forEach(point => {
        if (Math.random() < 0.15) {
            let grassSprite = this._scene.add.image(point.x + x, point.y + y - 15, 'atlas', 'grass')
            this.dynamicTextures.push({ x1: grassSprite.x, x2: grassSprite.x, texture: grassSprite, type: 'Image' })
        }
    })

    // Create physics body using this._scene
    let terrainBody = this._scene.matter.add.fromVertices(
        WIDTH / 2 + x,
        HEIGHT / 2 + y,
        vertexSets,
        {
            label: 'terrain',
            isStatic: true,
            friction: 0.7
        },
        true,
        0.01,
        1
    )

    // Set position
    let centerOfMass = Matter.Vector.sub(terrainBody.bounds.min, terrainBody.position)
    Matter.Body.setPosition(terrainBody, { x: Math.abs(centerOfMass.x) + x, y: Math.abs(centerOfMass.y) + y })
  }

  update() {
    let x1 = this._scene.cameras.main.worldView.x
    let x2 = x1 + this._scene.cameras.main.worldView.width

    const isVisible = (points: DynamicTextures): boolean => {
      const case1 = points.x1 > x1 && points.x1 < x2
      const case2 = points.x2 > x1 && points.x2 < x2
      const case3 = points.x1 < x1 && points.x2 > x2
      return case1 || case2 || case3
    }

    let countVisible = 0
    this.dynamicTextures.forEach(whole => {
      if (whole.texture.visible) countVisible++
      if (isVisible(whole)) {
        if (!whole.texture.visible) {
          whole.texture.setVisible(true)
        }
      } else {
        if (whole.texture.visible) whole.texture.setVisible(false)
      }
    })
  }
}
