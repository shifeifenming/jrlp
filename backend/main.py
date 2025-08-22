import os
import random
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

IMAGE_DIR = "./img"

# 挂载静态文件目录
app.mount("/img", StaticFiles(directory=IMAGE_DIR), name="images")

@app.get("/api/character")

async def get_random_character_data():
    try:
        image_files = [f for f in os.listdir(IMAGE_DIR) if os.path.isfile(os.path.join(IMAGE_DIR, f))]
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Image directory not found.")
    
    valid_image_files = [f for f in image_files if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
    
    if not valid_image_files:
        raise HTTPException(status_code=404, detail="No images found in the directory.")
    
    random_image_file = random.choice(valid_image_files)
    
    file_name_without_extension = os.path.splitext(random_image_file)[0]
    
    image_url = f"http://localhost:18428/img/{random_image_file}"
    
    return {
        "filename": file_name_without_extension,
        "image_url": image_url
    }

@app.get('/')
async def root():
    return {"message": "Welcome!"}

@app.get("/favicon.ico")
async def favicon():
    return FileResponse("favicon.ico")

# 运行命令：uvicorn main:app --host 0.0.0.0 --port 18428
# 如果需要更改端口请同步更改代码
