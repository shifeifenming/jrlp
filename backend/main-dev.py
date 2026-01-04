import os
import random
import argparse
import uvicorn
import psutil
import base64
import sys
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

IMAGE_DIR = "./img"

access_counts = {
    "/api/character": 0,
    "/status": 0
}

DEBUG_MODE = False


def debug_log(message):
    if DEBUG_MODE:
        print(f"[DEBUG] {message}", file=sys.stderr)


def count_images_recursive(directory):
    total = 0
    valid_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.webp')
    try:
        items = os.listdir(directory)
        for item in items:
            full_path = os.path.join(directory, item)
            if os.path.isdir(full_path):
                total += count_images_recursive(full_path)
            elif os.path.isfile(full_path) and item.lower().endswith(valid_extensions):
                total += 1
    except Exception:
        pass
    return total


app.mount("/img", StaticFiles(directory=IMAGE_DIR), name="images")


@app.get("/api/character")
async def get_random_character_data():
    access_counts["/api/character"] += 1

    try:
        debug_log(f"开始扫描目录: {IMAGE_DIR}")
        top_level_items = os.listdir(IMAGE_DIR)
        if not top_level_items:
            raise HTTPException(status_code=404, detail="主图片目录中没有找到任何项目")

        random_item = random.choice(top_level_items)
        random_item_path = os.path.join(IMAGE_DIR, random_item)
        debug_log(f"随机选中项: {random_item_path}")

        selected_image_file = None

        if os.path.isdir(random_item_path):
            image_files_in_folder = [f for f in os.listdir(random_item_path) if
                                     f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
            if not image_files_in_folder:
                debug_log(f"文件夹为空或无图片: {random_item}")
                raise HTTPException(status_code=404, detail=f"文件夹 '{random_item}' 中没有找到图片")
            selected_sub_file = random.choice(image_files_in_folder)
            selected_image_file = os.path.join(random_item, selected_sub_file)

        elif os.path.isfile(random_item_path) and random_item.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            selected_image_file = random_item

        else:
            debug_log(f"无效的项目类型或格式: {random_item}")
            raise HTTPException(status_code=500, detail="目录中发现无效的项目类型")

        if not selected_image_file:
            raise HTTPException(status_code=404, detail="无法找到一个有效的图片文件")

        full_path = os.path.join(IMAGE_DIR, selected_image_file)
        debug_log(f"最终确定的图片路径: {full_path}")

        with open(full_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        debug_log("Base64 转换成功")

        file_name_without_extension = os.path.splitext(os.path.basename(selected_image_file))[0]
        image_url = f"http://localhost:18428/img/{selected_image_file.replace(os.sep, '/')}"

        return {
            "filename": file_name_without_extension,
            "image_url": image_url,
            "image_base64": encoded_string
        }

    except FileNotFoundError:
        debug_log("错误: 找不到文件或目录")
        raise HTTPException(status_code=500, detail="图片目录没有找到")
    except Exception as e:
        debug_log(f"捕获到未处理异常: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/status")
async def get_system_status():
    access_counts["/status"] += 1
    cpu_usage = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory()
    total_images = count_images_recursive(IMAGE_DIR)

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
        "image_statistics": {
            "total_count": total_images
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
    parser = argparse.ArgumentParser(description="运行 FastAPI 应用程序")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="要绑定的主机地址")
    parser.add_argument("--port", type=int, default=18428, help="要绑定的端口号")
    parser.add_argument("--debug", action="store_true", help="开启调试输出")

    args = parser.parse_args()

    if args.debug:
        DEBUG_MODE = True
        print("[INFO] 调试模式已开启")

    uvicorn.run("main-dev:app", host=args.host, port=args.port, reload=True)