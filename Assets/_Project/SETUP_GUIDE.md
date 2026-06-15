# VELOCITY ZERO — Unity Setup Guide

## Requisitos
- Unity 2022.3 LTS o superior
- Universal Render Pipeline (URP)
- Packages necesarios:
  - Input System
  - TextMeshPro
  - Cinemachine (opcional para cámara)
  - DOTween (opcional para animaciones UI)

## Pasos de configuración

### 1. Importar scripts
Copia toda la carpeta `Assets/_Project/` dentro del proyecto Unity que ya tienes
en `C:\Users\Jorge Ramirez\Documents\UNITY\VelocityZero\Assets\`.

### 2. Configurar tags y layers
En Edit > Project Settings > Tags and Layers, añade:
- Tag: `Player`
- Tag: `NearMissDetector`
- Tag: `Obstacle`
- Tag: `Collectible`
- Layer: `Player` (layer 8)
- Layer: `Obstacle` (layer 9)

### 3. Configurar Input System
Cambia a New Input System en Project Settings > Player > Active Input Handling.

### 4. Crear ScriptableObjects
En la carpeta `Assets/_Project/ScriptableObjects/`, haz clic derecho > Create:
- `VelocityZero/AnchorConfig` → llámalo `AnchorConfig_Default`
  - BaseStartSpeed: 60
  - Amax: 280
  - Tau: 120
  - SpeedToWorldScale: 0.05
  - ZoneSpeedMultiplier: 1.15
  - AnchorThresholds: [80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300]

### 5. Crear escenas

#### Escena: Game
Jerarquía recomendada:
```
Game (escena)
├── [Managers]
│   ├── GameManager         (GameManager.cs)
│   ├── SpeedManager        (SpeedManager.cs) → asignar AnchorConfig
│   ├── AnchorSystem        (AnchorSystem.cs) → asignar AnchorConfig
│   ├── ComboSystem         (ComboSystem.cs)
│   ├── ZoneSystem          (ZoneSystem.cs)
│   ├── ScoreManager        (ScoreManager.cs)
│   ├── EconomyManager      (EconomyManager.cs)
│   ├── SaveManager         (SaveManager.cs)
│   └── AudioManager        (AudioManager.cs)
│
├── [Input]
│   └── InputHandler        (InputHandler.cs)
│
├── [World]
│   └── SpawnManager        (SpawnManager.cs)
│       └── (chunks spawned at runtime)
│
├── [Player]
│   └── Player              (PlayerController.cs, Rigidbody, CapsuleCollider tag:Player)
│       ├── NearMissDetector (CapsuleCollider trigger, tag:NearMissDetector, ligeramente más grande)
│       └── Model            (personaje 3D / cubo placeholder)
│
├── [Camera]
│   └── Main Camera         (posición: 0, 3, -6 / rotación: 15, 0, 0)
│
├── [UI]
│   └── Canvas
│       ├── HUD             (HUDController.cs)
│       ├── GameOverScreen  (GameOverScreen.cs)
│       └── PauseOverlay
│
└── [Gameplay]
    └── RunController       (RunController.cs)
```

### 6. Player GameObject
- CapsuleCollider: Height=1.8, Radius=0.35, tag=Player
- Rigidbody: isKinematic=true, constraints=FreezeAll
- NearMissDetector child: CapsuleCollider (trigger), Height=2.0, Radius=0.7, tag=NearMissDetector
- PlayerController.cs: asignar InputHandler reference

### 7. Chunk Prefabs (placeholder para MVP)
Crea un chunk placeholder:
1. Empty GameObject "Chunk_Simple_01"
2. Añade ChunkController.cs
3. Añade ObstácuPos children (cubos rojos con ObstacleController.cs)
4. Crea ChunkData SO y asigna el prefab

### 8. HUD Bindings (Canvas/HUD)
Asigna en el Inspector de HUDController:
- SpeedText: TextMeshPro mostrando velocidad
- ScoreText: TextMeshPro para score
- ComboText: TextMeshPro para combo
- ZoneBar: Slider para energía de ZONA
- PauseButton: Button para pausar

### 9. GameOverScreen Bindings
Asigna en Inspector de GameOverScreen todos los TextMeshPro fields.
Botones: RetryButton → GameManager.StartRun(), MenuButton → GameManager.GoToMainMenu()

### 10. Testing rápido del MVP
1. Pon las 3 escenas en Build Settings (orden: Boot, MainMenu, Game)
2. Play la escena Game directamente
3. GameManager arranca → InGame → SpeedManager empieza a contar
4. Desliza para cambiar de carril
5. Choca con un obstáculo → GameOverScreen aparece
6. Reintentar → nueva carrera, velocidad persistente

---

## Estructura de carpetas Assets/_Project/

```
Scripts/
  Core/
    Enums.cs
    EventBus.cs
    GameManager.cs
    Pooling/
      ObjectPool.cs
      PoolManager.cs
      PoolableObject.cs
  Gameplay/
    InputHandler.cs
    PlayerController.cs
    SpawnManager.cs
    ChunkController.cs
    ObstacleController.cs
    RunController.cs
  Systems/
    SpeedManager.cs
    AnchorSystem.cs
    ComboSystem.cs
    ZoneSystem.cs
    ScoreManager.cs
    EconomyManager.cs
    SaveManager.cs
  UI/
    HUDController.cs
    GameOverScreen.cs
    MainMenuController.cs
  Data/
    AnchorConfig.cs
    CharacterData.cs
    WorldData.cs
    ObstacleData.cs
    ChunkData.cs
  Audio/
    AudioManager.cs
  Utils/
    Extensions.cs
```

## Orden de adición al proyecto (evitar errores de compilación)
1. Enums.cs y EventBus.cs primero
2. ObjectPool → PoolManager → PoolableObject
3. ScriptableObjects (Data/)
4. Gameplay scripts
5. Systems scripts
6. UI scripts
7. Audio y Utils
