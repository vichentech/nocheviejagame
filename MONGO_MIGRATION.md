# Guía de Migración de Volúmenes de MongoDB

Esta guía detalla los pasos para mover los datos de una base de datos MongoDB desde un volumen gestionado por Docker a una carpeta local en tu servidor (bind mount). Esto facilita la gestión de copias de seguridad.

## Prerrequisitos

- Acceso por terminal (SSH) a la VPS o máquina donde corre Docker.
- Permisos de `sudo`.

## Pasos para la migración

### 1. Detener los contenedores
Es crítico detener la base de datos para asegurar que no haya escrituras durante la copia.

```bash
docker-compose down
```

### 2. Identificar el volumen antiguo
Lista los volúmenes de Docker para encontrar el nombre exacto del volumen de tu proyecto.

```bash
docker volume ls
```
*Busca un nombre similar a `juegonochevieja_mongo_data` o `nombredelproyecto_mongo_data`.*

### 3. Encontrar la ruta de los datos
Una vez tengas el nombre del volumen (ej. `juegonochevieja_mongo_data`), inspecciónalo para ver dónde están los archivos físicamente en el disco.

```bash
docker volume inspect juegonochevieja_mongo_data
```
Busca la propiedad `"Mountpoint"`. Usualmente es algo como:
`/var/lib/docker/volumes/juegonochevieja_mongo_data/_data`

### 4. Copiar los datos
Crea la carpeta destino en tu proyecto y copia los datos. Asegúrate de estar en la raíz de tu proyecto.

```bash
# Crear la carpeta local
mkdir -p mongo_data

# Copiar los datos (requiere sudo por permisos de Docker)
# Reemplaza 'juegonochevieja_mongo_data' por el nombre real de tu volumen
sudo cp -r /var/lib/docker/volumes/juegonochevieja_mongo_data/_data/* ./mongo_data/
```

### 5. Corregir permisos (CRÍTICO)
MongoDB dentro del contenedor suele ejecutarse con el usuario/grupo `999`. Al copiar con `sudo`, los archivos pasan a ser de `root`, lo que impedirá que Mongo arranque. Corrige esto asignando el dueño correcto:

```bash
sudo chown -R 999:999 ./mongo_data
```

### 6. Actualizar docker-compose.yml
Asegúrate de que tu `docker-compose.yml` apunte a esta nueva carpeta.

```yaml
services:
  mongo:
    volumes:
      - ./mongo_data:/data/db
```

### 7. Reiniciar
Levanta los contenedores. Docker ahora usará tu carpeta local con los datos migrados.

```bash
docker-compose up -d --build
```
