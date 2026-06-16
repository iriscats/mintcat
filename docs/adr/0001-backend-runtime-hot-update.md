# Backend Runtime hot update boundary

MintCat will keep a stable Tauri Control Plane and route hot-updatable business capabilities through an officially signed Backend Runtime, with release sets coordinating compatible frontend, runtime, and resource components. We chose this over runtime Tauri command registration because Tauri invoke handlers are compiled into the shell, and over third-party/native plugin loading because the first supported runtime is trusted first-party native code where update safety is handled through signing, release set activation, and bundled safe mode recovery.
