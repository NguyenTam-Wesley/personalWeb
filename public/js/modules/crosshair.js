export class CrosshairManager {
    static async copyCode(button) {
        try {
            const code = button.parentElement.querySelector('code').textContent;
            await navigator.clipboard.writeText(code);
            
            // Hiệu ứng copy thành công
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.backgroundColor = '#28a745';
            
            // Hiển thị thông báo
            this.showNotification('Crosshair code đã được copy!', 'success');
            
            // Reset button sau 2 giây
            setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = '';
            }, 2000);
        } catch (error) {
            console.error('Lỗi khi copy code:', error);
            this.showNotification('Không thể copy code. Vui lòng thử lại!', 'error');
        }
    }

    static showNotification(message, type = 'success') {
        // Tạo element thông báo
        const notification = document.createElement('div');
        notification.className = `crosshair-notification ${type}`;
        notification.textContent = message;
        
        // Thêm vào body
        document.body.appendChild(notification);
        
        // Hiệu ứng fade in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Tự động ẩn sau 3 giây
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    static init() {
        // Thêm style cho notification
        const style = document.createElement('style');
        style.textContent = `
            .crosshair-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 4px;
                color: white;
                font-weight: 500;
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s ease;
                z-index: 1000;
            }
            .crosshair-notification.show {
                opacity: 1;
                transform: translateY(0);
            }
            .crosshair-notification.success {
                background-color: #28a745;
            }
            .crosshair-notification.error {
                background-color: #dc3545;
            }
        `;
        document.head.appendChild(style);

        // Thêm event listener cho tất cả các nút copy
        document.querySelectorAll('.copy-button').forEach(button => {
            button.onclick = () => this.copyCode(button);
        });
    }
} 