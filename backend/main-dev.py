import os
import random
import argparse
import uvicorn
import psutil
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

# 存放图片的目录
IMAGE_DIR = "./img"

# 访问计数器
access_counts = {
    "/api/character": 0,
    "/status": 0
}

# 挂载静态文件目录，允许通过 /img/... 访问图片
app.mount("/img", StaticFiles(directory=IMAGE_DIR), name="images")

@app.get("/api/character")
async def get_random_character_data():
    access_counts["/api/character"] += 1
    
    try:
        # 列出 img 目录下的所有文件和文件夹
        top_level_items = os.listdir(IMAGE_DIR)
        if not top_level_items:
            raise HTTPException(status_code=404, detail="主图片目录中没有找到任何项目")

        # 随机选择一个文件或文件夹
        random_item = random.choice(top_level_items)
        random_item_path = os.path.join(IMAGE_DIR, random_item)
        
        selected_image_file = None
        
        if os.path.isdir(random_item_path):
            # 如果是文件夹，则进入并随机选择一张图片
            image_files_in_folder = [f for f in os.listdir(random_item_path) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
            if not image_files_in_folder:
                raise HTTPException(status_code=404, detail=f"文件夹 '{random_item}' 中没有找到图片")
            selected_image_file = os.path.join(random_item, random.choice(image_files_in_folder))
        
        elif os.path.isfile(random_item_path) and random_item.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
            selected_image_file = random_item
            
        else:
            # 如果选择的项目既不是文件夹也不是支持的图片格式，则抛出异常
            raise HTTPException(status_code=500, detail="目录中发现无效的项目类型")

        if not selected_image_file:
             raise HTTPException(status_code=404, detail="无法找到一个有效的图片文件")

        file_name_without_extension = os.path.splitext(os.path.basename(selected_image_file))[0]
        image_url = f"http://localhost:18428/img/{selected_image_file.replace(os.sep, '/')}"

        return {
            "filename": file_name_without_extension,
            "image_url": image_url
        }

    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="图片目录没有找到")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status")
async def get_system_status():
    access_counts["/status"] += 1
    
    # CPU
    cpu_usage = psutil.cpu_percent(interval=1)
    
    # RAM
    mem = psutil.virtual_memory()
    mem_total_gb = round(mem.total / (1024 ** 3), 2)
    mem_used_gb = round(mem.used / (1024 ** 3), 2)
    mem_usage = mem.percent
    
    return {
        "service_availability": "Available",
        "system_metrics": {
            "cpu_usage_percent": cpu_usage,
            "memory_usage": {
                "total_gb": mem_total_gb,
                "used_gb": mem_used_gb,
                "percent": mem_usage
            }
        },
        "access_statistics": access_counts
    }

@app.get('/')
async def root():
    return {"message": "欢迎！"}

@app.get("/favicon.ico")
async def favicon():
    return FileResponse("favicon.ico")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="运行 FastAPI 应用程序，可配置主机和端口")
    
    # --host 参数 默认 0.0.0.0
    parser.add_argument("--host", type=str, default="0.0.0.0", help="要绑定的主机地址")
    
    # --port 参数 默认 18428
    parser.add_argument("--port", type=int, default=18428, help="要绑定的端口号")

    args = parser.parse_args()

    # 运行 uvicorn
    uvicorn.run("main-dev:app", host=args.host, port=args.port, reload=True)
