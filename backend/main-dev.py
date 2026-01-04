import os
import random
import argparse
import uvicorn
import psutil
import base64
import sys
import urllib.parse
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

IMAGE_DIR = "./img"
cached_image_paths = []
access_counts = {"/api/character": 0, "/status": 0}
DEBUG_MODE = False


def debug_log(message):
    if DEBUG_MODE:
        print(f"[DEBUG] {message}", file=sys.stderr)


def refresh_image_cache():
    """扫描目录并刷新预加载列表"""
    global cached_image_paths
    valid_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.webp')
    temp_list = []
    if not os.path.exists(IMAGE_DIR):
        os.makedirs(IMAGE_DIR)
    for root, dirs, files in os.walk(IMAGE_DIR):
        for f in files:
            if f.lower().endswith(valid_extensions):
                # 存储相对于 IMAGE_DIR 的原始路径
                rel_path = os.path.relpath(os.path.join(root, f), IMAGE_DIR)
                temp_list.append(rel_path)
    cached_image_paths = temp_list
    debug_log(f"缓存已刷新，共加载 {len(cached_image_paths)} 张图片")


@asynccontextmanager
async def lifespan(app: FastAPI):
    refresh_image_cache()
    yield
    debug_log("服务器正在关闭...")


app = FastAPI(lifespan=lifespan)

# 静态文件挂载
app.mount("/img", StaticFiles(directory=IMAGE_DIR), name="images")


@app.get("/api/character")
async def get_random_character_data():
    access_counts["/api/character"] += 1
    if not cached_image_paths:
        refresh_image_cache()

    if not cached_image_paths:
        raise HTTPException(status_code=404, detail="图片目录中没有找到任何有效图片")

    try:
        selected_rel_path = random.choice(cached_image_paths)
        full_path = os.path.join(IMAGE_DIR, selected_rel_path)

        with open(full_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

        # 文件名（不含后缀）用于显示，不需要编码
        file_name_without_extension = os.path.splitext(os.path.basename(selected_rel_path))[0]

        # 统一分隔符为 /
        path_with_slashes = selected_rel_path.replace(os.sep, '/')
        # 对路径进行 URL 编码，保留斜杠不编码
        encoded_sub_path = urllib.parse.quote(path_with_slashes)
        image_sub = f"/img/{encoded_sub_path}"

        debug_log(f"选中图片: {selected_rel_path} -> 编码后路径: {image_sub}")

        return {
            "filename": file_name_without_extension,
            "image_sub": image_sub,
            "image_base64": encoded_string
        }
    except Exception as e:
        debug_log(f"错误: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/status")
async def get_system_status():
    access_counts["/status"] += 1
    cpu_usage = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory()
    return {
        "service_availability": "Available",
        "system_metrics": {
            "cpu_usage_percent": cpu_usage,
            "memory_usage": {
                "total_gb": round(mem.total / (1024 ** 3), 2),
                "used_gb": round(mem.used / (1024 ** 3), 2),
                "percent": mem.percent
            }
        },
        "image_statistics": {"total_count": len(cached_image_paths)},
        "access_statistics": access_counts
    }


@app.get('/')
async def root():
    return {"message": "欢迎！"}


@app.get("/favicon.ico")
async def favicon():
    if os.path.exists("favicon.ico"):
        return FileResponse("favicon.ico")
    raise HTTPException(status_code=404)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="运行 FastAPI 应用程序")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="要绑定的主机地址")
    parser.add_argument("--port", type=int, default=18428, help="要绑定的端口号")
    parser.add_argument("--debug", action="store_true", help="开启调试输出")

    args = parser.parse_args()
    if args.debug:
        DEBUG_MODE = True
        print("[INFO] 调试模式已开启")

    module_name = os.path.basename(__file__).replace(".py", "")
    uvicorn.run(f"{module_name}:app", host=args.host, port=args.port, reload=True)