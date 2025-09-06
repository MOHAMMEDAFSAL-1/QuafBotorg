// =============================
// 🌐 Global Variables
// =============================
let currentUser = null;
let currentPage = 'tasks';
let currentCourse = null;
let currentStep = 0;
let currentDate = new Date();
let chartInstances = {};

// Cache for better performance
let dataCache = {
    users: null,
    tasks: null,
    courses: null,
    events: null,
    lastUpdated: null
};

// =============================
// 📊 Optimized Google Sheets Integration
// =============================
class GoogleSheetsAPI {
    constructor() {
        this.apiUrl = "https://script.google.com/macros/s/AKfycbzvftf-azjEqwaB_7Ov2bP6ZyqSY0VG6zvoU9PmJblQFQKgMweQNufJ_s1fM4XaBPmD7w/exec";
        this.cache = new Map();
        this.cacheTimeout = 2 * 60 * 1000; // 2 minutes cache
    }

    async getSheet(sheetName, useCache = true) {
        const cacheKey = sheetName;
        
        // Check cache first
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const url = `${this.apiUrl}?sheet=${encodeURIComponent(sheetName)}&cachebust=${Date.now()}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            const data = JSON.parse(text);
            
            // Cache the result
            if (useCache) {
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
            }
            
            return data;
        } catch (error) {
            console.error(`Error fetching ${sheetName}:`, error);
            return { error: error.message };
        }
    }

    clearCache() {
        this.cache.clear();
    }

    async addRow(sheetName, row) {
        try {            
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    sheet: sheetName,
                    data: JSON.stringify(row)
                })
            });
            
            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (parseError) {
                result = { message: text };
            }
            
            // Clear relevant cache entries after adding data
            this.cache.delete(sheetName);
            
            return result;
        } catch (error) {
            console.error('Error adding row:', error);
            return { error: error.message };
        }
    }
}


const api = new GoogleSheetsAPI();

// =============================
// 🔑 Optimized Authentication
// =============================
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('loginError');

    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }

    // Show loading state
    const loginBtn = document.querySelector('button[type="submit"]');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing In...';
    loginBtn.disabled = true;

    try {
        console.log('Attempting login with:', username);
        const users = await api.getSheet("user_credentials", false);
        console.log('Raw response:', users);
        
        if (!users || users.error) {
            showError(users?.error || 'Failed to fetch user data');
            return;
        }
        
        if (!Array.isArray(users) || users.length === 0) {
            showError('No users found in database');
            return;
        }
        
        // Simple exact match
        const user = users.find(u => 
            u.username === username && u.password === password
        );

        if (user) {
            currentUser = {
                username: user.username,
                name: user.full_name || user.username,
                role: user.role || 'student',
                userId: user.username
            };

            // Hide login, show dashboard
            document.getElementById('loginPage').classList.add('hidden');
            document.getElementById('dashboardContainer').classList.remove('hidden');
            document.getElementById('welcomeUser').textContent = `Welcome, ${currentUser.name}`;

            // Load dashboard data
            await Promise.all([
            loadTasks(),
            loadCourses(),
            loadEvents(),
            loadTimeTable() // Add this line
            ]);
            
            showPage('tasks');
            hideError();
        } else {
            showError('Invalid username or password');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error: ' + error.message);
    } finally {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('loginError').classList.add('hidden');
}

function logout() {
    currentUser = null;
    api.clearCache(); // Clear cache on logout
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardContainer').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    hideError();
}

// Add these functions after the existing login/logout functions

function showSignup() {
    document.getElementById('loginForm').parentElement.classList.add('hidden');
    document.getElementById('signupSection').classList.remove('hidden');
    hideError();
}

function showLogin() {
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden'); // Changed from loginForm parent
    hideSignupError();
    hideSignupSuccess();
}

function showSignupError(message) {
    const errorDiv = document.getElementById('signupError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideSignupError() {
    document.getElementById('signupError').classList.add('hidden');
}

function showSignupSuccess(message) {
    const successDiv = document.getElementById('signupSuccess');
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');
}

function hideSignupSuccess() {
    document.getElementById('signupSuccess').classList.add('hidden');
}

async function submitSignup() {
    const name = document.getElementById('signupName').value.trim();
const phone = document.getElementById('signupPhone').value.trim();
const gmail = document.getElementById('signupGmail').value.trim();
const state = document.getElementById('signupState').value.trim();
const district = document.getElementById('signupDistrict').value.trim();
const place = document.getElementById('signupPlace').value.trim();
const po = document.getElementById('signupPO').value.trim();
const pinCode = document.getElementById('signupPinCode').value.trim();

if (!name || !phone || !state || !district || !place || !po || !pinCode) {
    showSignupError('Please fill in all required fields');
    return;
}

// Validate pin code
if (!/^\d{6}$/.test(pinCode)) {
    showSignupError('Please enter a valid 6-digit pin code');
    return;
}


    // Show loading state
    const signupBtn = document.querySelector('#signupForm button[type="submit"]');
    const originalText = signupBtn.innerHTML;
    signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating Account...';
    signupBtn.disabled = true;

    try {
        const rowData = [
    name,
    phone,
    gmail || '',
    state,
    district,
    place,
    po,
    pinCode,
    new Date().toISOString().split('T')[0] // Registration date
];

        
        const result = await api.addRow('registration', rowData);
        console.log('Signup result:', result);

        if (result && (result.success || result.includes?.('Success'))) {
            showSignupSuccess('Account created successfully! Please contact admin for login credentials.');
            document.getElementById('signupForm').reset();
            hideSignupError();
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showSignupError('Registration failed: ' + error.message);
    } finally {
        signupBtn.innerHTML = originalText;
        signupBtn.disabled = false;
    }
}

// Add event listener for signup form
document.addEventListener('DOMContentLoaded', function() {
    loadCalendar();
    
    // Add signup form event listener
    document.getElementById('signupForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitSignup();
    });
});

// =============================
// 📍 Navigation
// =============================
function showPage(page) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('border-green-500', 'text-green-600');
        btn.classList.add('border-transparent');
    });

    document.getElementById(page + 'Page').classList.remove('hidden');
    
    // Find the clicked button and highlight it
    const clickedBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => 
        btn.textContent.toLowerCase().includes(page)
    );
    if (clickedBtn) {
        clickedBtn.classList.add('border-green-500', 'text-green-600');
    }

    currentPage = page;

    if (page === 'events') {
        loadCalendar();
    } else if (page === 'status') {
        loadStatusCharts();
    }
}

// =============================
// ✅ Optimized Tasks
// =============================
async function loadTasks() {
    const tasksContainer = document.getElementById('tasksList');
    
    // Show loading state
    tasksContainer.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading tasks...</div>';

    try {
        const [tasks, progress] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
        tasksContainer.innerHTML = '';

        if (!tasks || tasks.length === 0) {
            tasksContainer.innerHTML = '<p class="text-gray-500">No tasks found.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();

        tasks.forEach(task => {
            const userTask = progress.find(p => 
                String(p.item_id) === String(task.task_id) && 
                p.item_type === "task" && 
                p.status === "complete"
            );
            const completed = !!userTask;

            const taskElement = document.createElement('div');
            taskElement.className = 'flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors';
            taskElement.innerHTML = `
                <input type="checkbox" id="task-${task.task_id}" ${completed ? 'checked' : ''} 
                       class="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500" ${completed ? 'disabled' : ''}>
                <div class="flex-1">
                    <h4 class="font-semibold ${completed ? 'line-through text-gray-500' : ''}">${task.title}</h4>
                    <p class="text-gray-600 text-sm">${task.description}</p>
                    <p class="text-xs text-gray-400">Due: ${task.due_date}</p>
                    ${completed ? '<span class="text-xs text-green-600 font-medium">✓ Completed</span>' : ''}
                </div>
            `;
            fragment.appendChild(taskElement);
        });

        tasksContainer.appendChild(fragment);
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasksContainer.innerHTML = '<p class="text-red-500">Error loading tasks.</p>';
    }
}

async function submitTasks() {
    const submitBtn = event.target;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Updating...';
    submitBtn.disabled = true;

    try {
        // Get selected tasks first
        const selectedTasks = [];
        document.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)').forEach(checkbox => {
            const taskId = checkbox.id.replace('task-', '');
            selectedTasks.push(taskId);
        });

        if (selectedTasks.length === 0) {
            alert('No new tasks were selected.');
            return;
        }

        const [tasks, progress] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
        const promises = [];
        let updatedCount = 0;

        for (let taskId of selectedTasks) {
            const existingTask = progress.find(p => 
                String(p.item_id) === String(taskId) && 
                p.item_type === "task" && 
                p.status === "complete"
            );
            
            if (!existingTask) {
                const rowData = [
                    taskId,
                    "task",
                    "complete",
                    new Date().toISOString().split('T')[0],
                    "100"
                ];
                
                promises.push(api.addRow(`${currentUser.username}_progress`, rowData));
                updatedCount++;
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
            alert(`${updatedCount} tasks updated successfully!`);
            await loadTasks();
            if (currentPage === 'status') {
                await loadStatusCharts();
            }
        } else {
            alert('All selected tasks are already completed.');
        }
    } catch (error) {
        console.error('Error submitting tasks:', error);
        alert('Error updating tasks. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// =============================
// 📚 Optimized Courses
// =============================
async function loadCourses() {
    const container = document.getElementById('coursesList');
    
    // Show loading state
    container.innerHTML = '<div class="col-span-3 text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading courses...</div>';

    try {
        const [courses, progress] = await Promise.all([
            api.getSheet("courses_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
        container.innerHTML = '';

        const fragment = document.createDocumentFragment();

        // Add regular courses first
        if (courses && courses.length > 0) {
            courses.forEach(course => {
                const userCourse = progress.find(p => 
                    String(p.item_id) === String(course.course_id) && 
                    p.item_type === "course" && 
                    p.status === "complete"
                );
                const completed = !!userCourse;

                const courseElement = document.createElement('div');
                courseElement.className = `bg-gray-50 rounded-lg p-6 hover:shadow-md transition duration-300 ${completed ? 'opacity-75' : 'cursor-pointer'}`;
                
                if (!completed) {
                    courseElement.onclick = () => openCourse(course);
                }

                courseElement.innerHTML = `
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-lg font-semibold ${completed ? 'text-gray-500 line-through' : 'text-green-600'}">${course.title}</h3>
                        ${completed ? 
                            '<i class="fas fa-check-circle text-green-600 text-xl"></i>' : 
                            '<i class="fas fa-play-circle text-gray-400"></i>'
                        }
                    </div>
                    <p class="text-gray-600 text-sm ${completed ? 'line-through' : ''}">${course.description}</p>
                    <div class="mt-4 text-sm ${completed ? 'text-green-600' : 'text-gray-500'}">
                        <i class="fas fa-book-open mr-1"></i>
                        ${completed ? '✓ Completed Course' : 'Islamic Studies Course'}
                    </div>
                `;
                fragment.appendChild(courseElement);
            });
        }

        // Add video courses
        videoCourses.forEach(videoCourse => {
            const userCourse = progress.find(p => 
                String(p.item_id) === String(videoCourse.course_id) && 
                p.item_type === "course" && 
                p.status === "complete"
            );
            const completed = !!userCourse;

            const courseElement = document.createElement('div');
            courseElement.className = `bg-gray-50 rounded-lg p-6 hover:shadow-md transition duration-300 ${completed ? 'opacity-75' : 'cursor-pointer'}`;
            
            if (!completed) {
                courseElement.onclick = () => openVideoCourse(videoCourse);
            }

            courseElement.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-semibold ${completed ? 'text-gray-500 line-through' : 'text-green-600'}">${videoCourse.title}</h3>
                    ${completed ? 
                        '<i class="fas fa-check-circle text-green-600 text-xl"></i>' : 
                        '<i class="fas fa-play-circle text-gray-400"></i>'
                    }
                </div>
                <p class="text-gray-600 text-sm ${completed ? 'line-through' : ''}">${videoCourse.description}</p>
                <div class="mt-4 text-sm ${completed ? 'text-green-600' : 'text-gray-500'}">
                    <i class="fas fa-video mr-1"></i>
                    ${completed ? '✓ Completed Course' : 'Video Course Collection'}
                </div>
            `;
            fragment.appendChild(courseElement);
        });

        // Add quiz courses at the bottom
        quizCourses.forEach(quizCourse => {
            const userCourse = progress.find(p => 
                String(p.item_id) === String(quizCourse.course_id) && 
                p.item_type === "course" && 
                p.status === "complete"
            );
            const completed = !!userCourse;

            const courseElement = document.createElement('div');
            courseElement.className = `bg-blue-50 rounded-lg p-6 hover:shadow-md transition duration-300 border-2 border-blue-200 ${completed ? 'opacity-75' : 'cursor-pointer'}`;
            
            if (!completed) {
                courseElement.onclick = () => openQuizCourse(quizCourse);
            }

            courseElement.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-semibold ${completed ? 'text-gray-500 line-through' : 'text-blue-600'}">${quizCourse.title}</h3>
                    ${completed ? 
                        '<i class="fas fa-check-circle text-blue-600 text-xl"></i>' : 
                        '<i class="fas fa-question-circle text-blue-400"></i>'
                    }
                </div>
                <p class="text-gray-600 text-sm ${completed ? 'line-through' : ''}">${quizCourse.description}</p>
                <div class="mt-4 text-sm ${completed ? 'text-blue-600' : 'text-blue-500'}">
                    <i class="fas fa-clipboard-question mr-1"></i>
                    ${completed ? '✓ Quiz Completed' : 'Interactive Quiz Course'}
                </div>
            `;
            fragment.appendChild(courseElement);
        });

        if (fragment.children.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-3">No courses found.</p>';
        } else {
            container.appendChild(fragment);
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        container.innerHTML = '<p class="text-red-500 col-span-3">Error loading courses.</p>';
    }
}


// Add video courses data
const videoCourses = [
    {
        course_id: 'video_course_1',
        title: 'Course Videos - Set 1',
        description: 'Islamic learning videos collection - Part 1',
        videos: [
            {
                title: 'Video 1',
                url: 'https://www.youtube.com/embed/VIDEO_ID_1'
            },
            {
                title: 'Video 2', 
                url: 'https://www.youtube.com/embed/VIDEO_ID_2'
            },
            {
                title: 'Video 3',
                url: 'https://www.youtube.com/embed/VIDEO_ID_3'
            },
            {
                title: 'Video 4',
                url: 'https://www.youtube.com/embed/VIDEO_ID_4'
            },
            {
                title: 'Video 5',
                url: 'https://www.youtube.com/embed/VIDEO_ID_5'
            }
        ]
    },
    {
        course_id: 'video_course_2',
        title: 'Course Videos - Set 2',
        description: 'Islamic learning videos collection - Part 2',
        videos: [
            {
                title: 'Video 1',
                url: 'https://www.youtube.com/embed/VIDEO_ID_6'
            },
            {
                title: 'Video 2',
                url: 'https://www.youtube.com/embed/VIDEO_ID_7'
            },
            {
                title: 'Video 3',
                url: 'https://www.youtube.com/embed/VIDEO_ID_8'
            },
            {
                title: 'Video 4',
                url: 'https://www.youtube.com/embed/VIDEO_ID_9'
            },
            {
                title: 'Video 5',
                url: 'https://www.youtube.com/embed/VIDEO_ID_10'
            }
        ]
    }
];

// Add quiz courses data after videoCourses array
const quizCourses = [
    {
        course_id: 'quiz_course_1',
        title: 'Course Practical - 1',
        description: 'Islamic knowledge quiz - Assessment 1',
        questions: [
            {
                question: "What is the first pillar of Islam?",
                options: ["Salah", "Shahada", "Zakat"],
                correct: 1
            },
            {
                question: "How many times a day do Muslims pray?",
                options: ["3 times", "5 times", "7 times"],
                correct: 1
            },
            {
                question: "Which month is the holy month of fasting?",
                options: ["Ramadan", "Shawwal", "Muharram"],
                correct: 0
            },
            {
                question: "What is the direction Muslims face when praying?",
                options: ["East", "West", "Qibla"],
                correct: 2
            },
            {
                question: "What is the holy book of Islam?",
                options: ["Torah", "Quran", "Bible"],
                correct: 1
            }
        ]
    },
    {
        course_id: 'quiz_course_2',
        title: 'Course Practical - 2',
        description: 'Islamic knowledge quiz - Assessment 2',
        questions: [
            {
                question: "Who is the last Prophet of Islam?",
                options: ["Prophet Isa", "Prophet Muhammad", "Prophet Musa"],
                correct: 1
            },
            {
                question: "What does 'Hajj' refer to?",
                options: ["Daily prayer", "Pilgrimage to Mecca", "Charity"],
                correct: 1
            },
            {
                question: "In which city is the Kaaba located?",
                options: ["Medina", "Mecca", "Jerusalem"],
                correct: 1
            },
            {
                question: "What is 'Zakat'?",
                options: ["Fasting", "Prayer", "Charitable giving"],
                correct: 2
            },
            {
                question: "How many chapters (Surahs) are in the Quran?",
                options: ["114", "110", "120"],
                correct: 0
            }
        ]
    }
];

// Add quiz-related variables after existing global variables
let currentQuiz = null;
let currentQuizStep = 0;
let quizAnswers = [];


async function openCourse(course) {
    try {
        // Check if course is already completed
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        const isCompleted = progress.find(p => 
            String(p.item_id) === String(course.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (isCompleted) {
            alert('This course is already completed!');
            return;
        }
        
        currentCourse = course;
        currentStep = 0;
        document.getElementById('courseTitle').textContent = course.title;
        document.getElementById('courseModal').classList.remove('hidden');
        loadCourseStep();
    } catch (error) {
        console.error('Error opening course:', error);
        alert('Error loading course. Please try again.');
    }
}


function closeCourseModal() {
    document.getElementById('courseModal').classList.add('hidden');
    currentCourse = null;
    currentStep = 0;
}

function loadCourseStep() {
    if (!currentCourse) return;
    
    // Handle video courses
    if (currentCourse.videos) {
        loadVideoStep();
        return;
    }
    
    // Rest of the existing function remains the same
    const content = document.getElementById('courseContent');
    const stepIndicator = document.getElementById('stepIndicator');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Get the current step content from the course data
    const stepKey = `step${currentStep + 1}`;
    const stepContent = currentCourse[stepKey] || `Step ${currentStep + 1} content`;
    
    content.innerHTML = `
        <div class="bg-green-50 p-4 sm:p-6 rounded-lg overflow-hidden">
            <h4 class="font-semibold text-green-600 mb-3 text-base sm:text-lg break-words">Step ${currentStep + 1}: ${currentCourse.title}</h4>
            <div class="text-gray-700 leading-relaxed mb-4 overflow-hidden">
                <p class="whitespace-pre-wrap break-words text-sm sm:text-base">${stepContent}</p>
            </div>
            
        </div>
    `;
    
    const totalSteps = 5;
    stepIndicator.textContent = `Step ${currentStep + 1} of ${totalSteps}`;

    prevBtn.disabled = currentStep === 0;
    prevBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${currentStep === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`;
    
    if (currentStep === totalSteps - 1) {
        nextBtn.innerHTML = 'Complete<i class="fas fa-check ml-1 sm:ml-2"></i>';
        nextBtn.onclick = completeCourse;
    } else {
        nextBtn.innerHTML = 'Next<i class="fas fa-chevron-right ml-1 sm:ml-2"></i>';
        nextBtn.onclick = nextStep;
    }
}


function nextStep() {
    const totalSteps = 5;
    if (currentStep < totalSteps - 1) {
        currentStep++;
        loadCourseStep();
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        if (currentQuiz && currentQuiz.questions) {
            loadQuizStep();
        } else if (currentCourse && currentCourse.videos) {
            loadVideoStep();
        } else {
            loadCourseStep();
        }
    }
}



async function completeCourse() {
    const completeBtn = document.getElementById('nextBtn');
    const originalText = completeBtn.innerHTML;
    completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Completing...';
    completeBtn.disabled = true;

    try {
        const [courses, progress] = await Promise.all([
            api.getSheet("courses_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
        // Check if course is already completed
        const existingCourse = progress.find(p => 
            String(p.item_id) === String(currentCourse.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (existingCourse) {
            alert('This course is already completed!');
            closeCourseModal();
            return;
        }

        const progressSheetName = `${currentUser.username}_progress`;
        const rowData = [
            currentCourse.course_id,
            "course",
            "complete",
            new Date().toISOString().split('T')[0],
            "100"
        ];
        
        const result = await api.addRow(progressSheetName, rowData);
        console.log('Course completion result:', result);

        if (result && (result.success || result.includes?.('Success'))) {
            alert('Congratulations! Course completed successfully!');
            closeCourseModal();
            await loadCourses();
            if (currentPage === 'status') {
                await loadStatusCharts();
            }
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error completing course:', error);
        alert('Error completing course: ' + error.message);
    } finally {
        completeBtn.innerHTML = originalText;
        completeBtn.disabled = false;
    }
}

async function openVideoCourse(videoCourse) {
    try {
        // Check if course is already completed
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        const isCompleted = progress.find(p => 
            String(p.item_id) === String(videoCourse.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (isCompleted) {
            alert('This course is already completed!');
            return;
        }
        
        currentCourse = videoCourse;
        currentStep = 0;
        document.getElementById('courseTitle').textContent = videoCourse.title;
        document.getElementById('courseModal').classList.remove('hidden');
        loadVideoStep();
    } catch (error) {
        console.error('Error opening video course:', error);
        alert('Error loading course. Please try again.');
    }
}

function loadVideoStep() {
    if (!currentCourse || !currentCourse.videos) return;
    const content = document.getElementById('courseContent');
    const stepIndicator = document.getElementById('stepIndicator');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    const currentVideo = currentCourse.videos[currentStep];
    
    content.innerHTML = `
        <div class="bg-green-50 p-4 sm:p-6 rounded-lg overflow-hidden">
            <h4 class="font-semibold text-green-600 mb-3 text-base sm:text-lg break-words">${currentVideo.title}</h4>
            <div class="video-container mb-4" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
                <iframe 
                    src="${currentVideo.url}" 
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                    frameborder="0" 
                    allowfullscreen>
                </iframe>
            </div>
        </div>
    `;
    
    const totalVideos = currentCourse.videos.length;
    stepIndicator.textContent = `Video ${currentStep + 1} of ${totalVideos}`;

    prevBtn.disabled = currentStep === 0;
    prevBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${currentStep === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`;
    
    if (currentStep === totalVideos - 1) {
        nextBtn.innerHTML = 'Complete<i class="fas fa-check ml-1 sm:ml-2"></i>';
        nextBtn.onclick = completeVideoCourse;
    } else {
        nextBtn.innerHTML = 'Next<i class="fas fa-chevron-right ml-1 sm:ml-2"></i>';
        nextBtn.onclick = nextVideoStep;
    }
}

function nextVideoStep() {
    const totalVideos = currentCourse.videos.length;
    if (currentStep < totalVideos - 1) {
        currentStep++;
        loadVideoStep();
    }
}

function prevVideoStep() {
    if (currentStep > 0) {
        currentStep--;
        loadVideoStep();
    }
}

async function completeVideoCourse() {
    const completeBtn = document.getElementById('nextBtn');
    const originalText = completeBtn.innerHTML;
    completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Completing...';
    completeBtn.disabled = true;

    try {
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        
        // Check if course is already completed
        const existingCourse = progress.find(p => 
            String(p.item_id) === String(currentCourse.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (existingCourse) {
            alert('This course is already completed!');
            closeCourseModal();
            return;
        }

        const progressSheetName = `${currentUser.username}_progress`;
        const rowData = [
            currentCourse.course_id,
            "course",
            "complete",
            new Date().toISOString().split('T')[0],
            "100"
        ];
        
        const result = await api.addRow(progressSheetName, rowData);
        console.log('Video course completion result:', result);

        if (result && (result.success || result.includes?.('Success'))) {
            alert('Congratulations! Video course completed successfully!');
            closeCourseModal();
            await loadCourses();
            if (currentPage === 'status') {
                await loadStatusCharts();
            }
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error completing video course:', error);
        alert('Error completing course: ' + error.message);
    } finally {
        completeBtn.innerHTML = originalText;
        completeBtn.disabled = false;
    }
}

async function openQuizCourse(quizCourse) {
    try {
        // Check if course is already completed
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        const isCompleted = progress.find(p => 
            String(p.item_id) === String(quizCourse.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (isCompleted) {
            alert('This quiz is already completed!');
            return;
        }
        
        currentQuiz = quizCourse;
        currentQuizStep = 0;
        quizAnswers = [];
        document.getElementById('courseTitle').textContent = quizCourse.title;
        document.getElementById('courseModal').classList.remove('hidden');
        loadQuizStep();
    } catch (error) {
        console.error('Error opening quiz course:', error);
        alert('Error loading quiz. Please try again.');
    }
}

function loadQuizStep() {
    if (!currentQuiz || !currentQuiz.questions) return;
    
    const content = document.getElementById('courseContent');
    const stepIndicator = document.getElementById('stepIndicator');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    const currentQuestion = currentQuiz.questions[currentQuizStep];
    const selectedAnswer = quizAnswers[currentQuizStep];
    
    content.innerHTML = `
        <div class="bg-blue-50 p-4 sm:p-6 rounded-lg overflow-hidden">
            <h4 class="font-semibold text-blue-600 mb-4 text-base sm:text-lg break-words">${currentQuiz.title} - Question ${currentQuizStep + 1}</h4>
            <div class="mb-6">
                <h5 class="text-gray-800 font-medium mb-4 text-sm sm:text-base">${currentQuestion.question}</h5>
                <div class="space-y-3">
                    ${currentQuestion.options.map((option, index) => `
                        <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-blue-100 transition-colors ${selectedAnswer === index ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}">
                            <input type="radio" name="quizAnswer" value="${index}" 
                                   ${selectedAnswer === index ? 'checked' : ''}
                                   onchange="selectQuizAnswer(${index})"
                                   class="mr-3 text-blue-600">
                            <span class="text-gray-700 text-sm sm:text-base">${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    const totalQuestions = currentQuiz.questions.length;
    stepIndicator.textContent = `Question ${currentQuizStep + 1} of ${totalQuestions}`;

    prevBtn.disabled = currentQuizStep === 0;
    prevBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${currentQuizStep === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`;
    
    if (currentQuizStep === totalQuestions - 1) {
        nextBtn.innerHTML = 'Submit Quiz<i class="fas fa-check ml-1 sm:ml-2"></i>';
        nextBtn.onclick = submitQuiz;
        nextBtn.disabled = selectedAnswer === undefined;
        nextBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${selectedAnswer === undefined ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`;
    } else {
        nextBtn.innerHTML = 'Next<i class="fas fa-chevron-right ml-1 sm:ml-2"></i>';
        nextBtn.onclick = nextQuizStep;
        nextBtn.disabled = selectedAnswer === undefined;
        nextBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${selectedAnswer === undefined ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`;
    }
}

function selectQuizAnswer(answerIndex) {
    quizAnswers[currentQuizStep] = answerIndex;
    // Refresh the step to update button states
    loadQuizStep();
}

function nextQuizStep() {
    const totalQuestions = currentQuiz.questions.length;
    if (currentQuizStep < totalQuestions - 1 && quizAnswers[currentQuizStep] !== undefined) {
        currentQuizStep++;
        loadQuizStep();
    }
}

function prevQuizStep() {
    if (currentQuizStep > 0) {
        currentQuizStep--;
        loadQuizStep();
    }
}

async function submitQuiz() {
    const submitBtn = document.getElementById('nextBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
    submitBtn.disabled = true;

    try {
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        
        // Check if quiz is already completed
        const existingQuiz = progress.find(p => 
            String(p.item_id) === String(currentQuiz.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (existingQuiz) {
            alert('This quiz is already completed!');
            closeCourseModal();
            return;
        }

        // Calculate score
        let correctAnswers = 0;
        currentQuiz.questions.forEach((question, index) => {
            if (quizAnswers[index] === question.correct) {
                correctAnswers++;
            }
        });
        
        const score = Math.round((correctAnswers / currentQuiz.questions.length) * 100);
        
        // Save to progress sheet
        const progressSheetName = `${currentUser.username}_progress`;
        const rowData = [
            currentQuiz.course_id,
            "course",
            "complete",
            new Date().toISOString().split('T')[0],
            score.toString()
        ];
        
        const result = await api.addRow(progressSheetName, rowData);
        console.log('Quiz completion result:', result);

        if (result && (result.success || result.includes?.('Success'))) {
            alert(`Quiz completed! Your score: ${correctAnswers}/${currentQuiz.questions.length} (${score}%)`);
            closeCourseModal();
            await loadCourses();
            if (currentPage === 'status') {
                await loadStatusCharts();
            }
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error submitting quiz:', error);
        alert('Error submitting quiz: ' + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}


// =============================
// 📅 Optimized Events
// =============================
async function loadEvents() {
    try {
        window.eventsData = await api.getSheet("events_master");
        console.log('Events loaded:', window.eventsData);
    } catch (error) {
        console.error('Error loading events:', error);
        window.eventsData = [];
    }
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    loadCalendar();
}

async function loadCalendar() {
    const events = window.eventsData || await api.getSheet("events_master");
    const calendar = document.getElementById('calendar');
    const monthTitle = document.getElementById('currentMonth');

    const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
    monthTitle.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    calendar.innerHTML = '';

    // Add day headers
    const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const fragment = document.createDocumentFragment();
    
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'text-center font-semibold text-gray-600 py-2 text-xs sm:text-sm';
        dayHeader.textContent = day;
        fragment.appendChild(dayHeader);
    });

    // Calculate calendar days
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    for (let i = 0; i < 42; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day p-1 sm:p-2 text-xs sm:text-sm';

        if (day.getMonth() !== currentDate.getMonth()) {
            dayElement.classList.add('text-gray-300', 'bg-gray-50');
        } else {
            dayElement.classList.add('hover:bg-green-50');
        }

        const dayEvents = events.filter(event => {
            if (!event.date) return false;
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === day.toDateString();
        });

        // Make entire day cell clickable if it has events
        if (dayEvents.length > 0) {
            dayElement.style.cursor = 'pointer';
            dayElement.onclick = () => openEventModal(day.toISOString().split('T')[0]);
        }

        dayElement.innerHTML = `
            <div class="font-medium">${day.getDate()}</div>
            ${dayEvents.length > 0 ? `
                <div class="event-indicator ${dayEvents.length > 1 ? 'multiple' : ''}" 
                     title="${dayEvents.length} event(s)">
                </div>
            ` : ''}
        `;
        
        fragment.appendChild(dayElement);
    }
    
    calendar.appendChild(fragment);
}

function openEventModal(dateString) {
    const events = window.eventsData || [];
    const dayEvents = events.filter(event => {
        if (!event.date) return false;
        const eventDate = new Date(event.date);
        return eventDate.toISOString().split('T')[0] === dateString;
    });

    if (dayEvents.length === 0) return;

    const modal = document.getElementById('eventModal');
    const titleElement = document.getElementById('eventTitle');
    const dateTimeElement = document.getElementById('eventDateTime');
    const detailsElement = document.getElementById('eventDetails');

    if (dayEvents.length === 1) {
        const event = dayEvents[0];
        titleElement.textContent = event.title || 'Event';
        
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        dateTimeElement.innerHTML = `
            <i class="fas fa-calendar-day mr-2"></i>${formattedDate}
            ${event.time ? `<br><i class="fas fa-clock mr-2"></i>${event.time}` : ''}
        `;

        detailsElement.innerHTML = `
            ${event.description ? `
                <div class="bg-green-50 p-3 rounded-lg">
                    <h4 class="font-semibold text-green-800 mb-2">Description</h4>
                    <p class="text-gray-700">${event.description}</p>
                </div>
            ` : ''}
            ${event.place ? `
                <div class="flex items-start space-x-2">
                    <i class="fas fa-map-marker-alt text-green-600 mt-1"></i>
                    <div>
                        <span class="font-semibold text-gray-800">Location:</span>
                        <span class="text-gray-700 ml-1">${event.place}</span>
                    </div>
                </div>
            ` : ''}
            ${event.details ? `
                <div class="flex items-start space-x-2">
                    <i class="fas fa-info-circle text-green-600 mt-1"></i>
                    <div>
                        <span class="font-semibold text-gray-800">Details:</span>
                        <span class="text-gray-700 ml-1">${event.details}</span>
                    </div>
                </div>
            ` : ''}
        `;
    } else {
        // Multiple events on same day
        titleElement.textContent = `${dayEvents.length} Events`;
        
        const eventDate = new Date(dayEvents[0].date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        dateTimeElement.innerHTML = `<i class="fas fa-calendar-day mr-2"></i>${formattedDate}`;

        detailsElement.innerHTML = dayEvents.map(event => `
            <div class="border-l-4 border-green-500 pl-4 mb-4 last:mb-0">
                <h4 class="font-semibold text-green-600 mb-1">${event.title || 'Event'}</h4>
                ${event.time ? `<p class="text-sm text-gray-600 mb-2"><i class="fas fa-clock mr-1"></i>${event.time}</p>` : ''}
                ${event.description ? `<p class="text-gray-700 text-sm mb-2">${event.description}</p>` : ''}
                ${event.place ? `<p class="text-sm text-gray-600"><i class="fas fa-map-marker-alt mr-1"></i>${event.place}</p>` : ''}
                ${event.details ? `<p class="text-sm text-gray-600"><i class="fas fa-info-circle mr-1"></i>${event.details}</p>` : ''}
            </div>
        `).join('');
    }

    modal.classList.remove('hidden');
}

function closeEventModal() {
    document.getElementById('eventModal').classList.add('hidden');
}

// Add click outside to close modal
document.getElementById('eventModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeEventModal();
    }
});

// =============================
// 📊 Optimized Charts & Progress
// =============================
async function loadStatusCharts() {
    const progressSheetName = `${currentUser.username}_progress`;
    const progress = await api.getSheet(progressSheetName);
    
    await Promise.all([
        loadTaskChart(progress),
        loadCourseChart(progress),
        loadActivityChart(progress),
        updateProgressBars(progress)
    ]);
}

async function loadTaskChart(progress) {
    const tasks = await api.getSheet("tasks_master");
    const completedTasks = progress.filter(p => p.item_type === "task" && p.status === "complete").length;
    const totalTasks = tasks.length;
    const pendingTasks = totalTasks - completedTasks;

    const ctx = document.getElementById('taskChart');
    if (!ctx) return;
    
    if (chartInstances.taskChart) {
        chartInstances.taskChart.destroy();
    }
    
    chartInstances.taskChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending'],
            datasets: [{
                data: [completedTasks, pendingTasks],
                backgroundColor: ['#059669', '#e5e7eb'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

async function loadCourseChart(progress) {
    const courses = await api.getSheet("courses_master");
    
    // Calculate total courses including video courses and quiz courses
    const totalRegularCourses = courses ? courses.length : 0;
    const totalVideoCourses = videoCourses.length;
    const totalQuizCourses = quizCourses.length;
    const totalCourses = totalRegularCourses + totalVideoCourses + totalQuizCourses;
    
    // Calculate completed courses (regular, video, and quiz)
    const completedCourses = progress.filter(p => p.item_type === "course" && p.status === "complete").length;
    const inProgressCourses = totalCourses - completedCourses;

    const ctx = document.getElementById('courseChart');
    if (!ctx) return;
    
    if (chartInstances.courseChart) {
        chartInstances.courseChart.destroy();
    }
    
    chartInstances.courseChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'In Progress'],
            datasets: [{
                data: [completedCourses, inProgressCourses],
                backgroundColor: ['#3b82f6', '#e5e7eb'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}



async function loadActivityChart(progress) {
    const now = new Date();
    const weeklyData = [0, 0, 0, 0];
    const weekLabels = [];
    
    for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7) - 7);
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() - (i * 7));
        
        weekLabels.push(`Week ${4-i}`);
        
        // Count all completions including video courses
        const weeklyCompletions = progress.filter(p => {
            if (!p.completion_date) return false;
            const completionDate = new Date(p.completion_date);
            return completionDate >= weekStart && completionDate < weekEnd && p.status === "complete";
        }).length;
        
        weeklyData[3-i] = weeklyCompletions;
    }

    const ctx = document.getElementById('activityChart');
    if (!ctx) return;
    
    if (chartInstances.activityChart) {
        chartInstances.activityChart.destroy();
    }
    
    chartInstances.activityChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: weekLabels,
            datasets: [{
                label: 'Items Completed',
                data: weeklyData,
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}


async function updateProgressBars(progress) {
    const [tasks, courses] = await Promise.all([
        api.getSheet("tasks_master"),
        api.getSheet("courses_master")
    ]);
    
    // Tasks progress
    const completedTasks = progress.filter(p => p.item_type === "task" && p.status === "complete").length;
    const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    
    document.getElementById('taskProgress').textContent = `${taskProgress}%`;
    document.getElementById('taskProgressBar').style.width = `${taskProgress}%`;

    // Courses progress (including video courses and quiz courses)
    const totalRegularCourses = courses ? courses.length : 0;
    const totalVideoCourses = videoCourses.length;
    const totalQuizCourses = quizCourses.length;
    const totalCourses = totalRegularCourses + totalVideoCourses + totalQuizCourses;
    
    const completedCourses = progress.filter(p => p.item_type === "course" && p.status === "complete").length;
    const courseProgress = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
    
    document.getElementById('courseProgressText').textContent = `${courseProgress}%`;
    document.getElementById('courseProgressBar').style.width = `${courseProgress}%`;

    // Events progress (placeholder)
    const eventProgress = 40;
    document.getElementById('eventProgress').textContent = `${eventProgress}%`;
    document.getElementById('eventProgressBar').style.width = `${eventProgress}%`;
}



// =============================
// 🎯 Event Listeners
// =============================
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    login();
});

document.addEventListener('DOMContentLoaded', function() {
    loadCalendar();
});

// Performance optimization: Debounce resize events
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
        if (currentPage === 'status') {
            Object.values(chartInstances).forEach(chart => {
                if (chart) chart.resize();
            });
        }
    }, 250);
});

// Expose functions for debugging
window.hudaAcademy = {
    login,
    logout,
    showPage,
    submitTasks,
    openCourse,
    completeCourse,
    clearCache: () => api.clearCache()
};

// =============================
// 📅 Time Table Functions
// =============================
async function loadTimeTable() {
    try {
        const scheduleSheetName = `${currentUser.username}_schedule`;
        console.log('Loading schedule for:', scheduleSheetName);
        const schedule = await api.getSheet(scheduleSheetName);
        console.log('Schedule data received:', schedule);
        
        const timetableBody = document.getElementById('timetableBody');
        timetableBody.innerHTML = '';

        if (!schedule || schedule.error || schedule.length === 0) {
            timetableBody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-8 text-gray-500">
                        No schedule found. Please contact administrator.
                        <br><small>Looking for: ${scheduleSheetName}</small>
                    </td>
                </tr>
            `;
            return;
        }

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const fragment = document.createDocumentFragment();

        days.forEach(dayName => {
            const daySchedule = schedule.find(s => s.day && s.day.toLowerCase() === dayName);
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors';

            // Day cell
            const dayCell = document.createElement('td');
            dayCell.className = 'border border-gray-300 p-2 font-semibold bg-gray-100 sticky left-0 z-10 text-xs sm:text-sm';
            dayCell.textContent = dayName.charAt(0).toUpperCase() + dayName.slice(1);
            row.appendChild(dayCell);

            // Period cells
            for (let period = 1; period <= 10; period++) {
                const periodCell = document.createElement('td');
                const subject = daySchedule ? (daySchedule[`period_${period}`] || 'Free') : 'Free';
                
                periodCell.className = `border border-gray-300 p-1 timetable-cell text-center text-xs sm:text-sm ${getSubjectClass(subject)}`;
                
                if (period === 6) { // Break period
                    periodCell.className += ' bg-orange-100 font-medium';
                }

                periodCell.innerHTML = `
                    <div class="font-medium">${subject}</div>
                    ${getSubjectIcon(subject)}
                `;
                
                row.appendChild(periodCell);
            }

            fragment.appendChild(row);
        });

        timetableBody.appendChild(fragment);
    } catch (error) {
        console.error('Error loading timetable:', error);
        document.getElementById('timetableBody').innerHTML = `
            <tr>
                <td colspan="11" class="text-center py-8 text-red-500">
                    Error loading timetable: ${error.message}<br>
                    Please check console for details.
                </td>
            </tr>
        `;
    }
}

function getSubjectClass(subject) {
    if (!subject) return 'subject-free';
    const subjectLower = subject.toLowerCase();
    
    // Handle abbreviated and full subject names
    if (subjectLower.includes('qura') || subjectLower.includes('quran') || subjectLower.includes('islamic') || 
        subjectLower.includes('hadith') || subjectLower.includes('fiqh') || subjectLower.includes('isl')) {
        return 'subject-islamic';
    } else if (subjectLower.includes('arb') || subjectLower.includes('arabic') || 
               subjectLower.includes('eng') || subjectLower.includes('english') || 
               subjectLower.includes('language')) {
        return 'subject-language';
    } else if (subjectLower.includes('mth') || subjectLower.includes('math') || 
               subjectLower.includes('sci') || subjectLower.includes('science') || 
               subjectLower.includes('computer') || subjectLower.includes('cop')) {
        return 'subject-science';
    } else if (subjectLower.includes('break') || subjectLower.includes('lunch') || 
               subjectLower.includes('prayer') || subjectLower.includes('rest')) {
        return 'subject-break';
    } else if (subjectLower.includes('free') || subjectLower.includes('study')) {
        return 'subject-free';
    } else if (subjectLower.includes('hds') || subjectLower.includes('history')) {
        return 'subject-science';
    } else if (subjectLower.includes('eco') || subjectLower.includes('economy')) {
        return 'subject-science';
    }
    return 'subject-free';
}

function getSubjectIcon(subject) {
    if (!subject) return '<i class="fas fa-book text-xs opacity-60"></i>';
    const subjectLower = subject.toLowerCase();
    
    // Handle abbreviated and full subject names
    if (subjectLower.includes('qura') || subjectLower.includes('quran') || subjectLower.includes('islamic')) {
        return '<i class="fas fa-mosque text-xs opacity-60"></i>';
    } else if (subjectLower.includes('arb') || subjectLower.includes('arabic') || 
               subjectLower.includes('eng') || subjectLower.includes('english')) {
        return '<i class="fas fa-language text-xs opacity-60"></i>';
    } else if (subjectLower.includes('mth') || subjectLower.includes('math')) {
        return '<i class="fas fa-calculator text-xs opacity-60"></i>';
    } else if (subjectLower.includes('sci') || subjectLower.includes('science')) {
        return '<i class="fas fa-flask text-xs opacity-60"></i>';
    } else if (subjectLower.includes('cop') || subjectLower.includes('computer')) {
        return '<i class="fas fa-laptop text-xs opacity-60"></i>';
    } else if (subjectLower.includes('break') || subjectLower.includes('lunch')) {
        return '<i class="fas fa-utensils text-xs opacity-60"></i>';
    } else if (subjectLower.includes('prayer') || subjectLower.includes('rest')) {
        return '<i class="fas fa-pray text-xs opacity-60"></i>';
    } else if (subjectLower.includes('hds') || subjectLower.includes('history')) {
        return '<i class="fas fa-scroll text-xs opacity-60"></i>';
    } else if (subjectLower.includes('eco') || subjectLower.includes('economy')) {
        return '<i class="fas fa-chart-line text-xs opacity-60"></i>';
    } else if (subjectLower.includes('pe') || subjectLower.includes('physical')) {
        return '<i class="fas fa-running text-xs opacity-60"></i>';
    } else if (subjectLower.includes('art')) {
        return '<i class="fas fa-palette text-xs opacity-60"></i>';
    } else if (subjectLower.includes('music')) {
        return '<i class="fas fa-music text-xs opacity-60"></i>';
    }
    return '<i class="fas fa-book text-xs opacity-60"></i>';
}

// Update the showPage function to include timetable
function showPage(page) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('border-green-500', 'text-green-600');
        btn.classList.add('border-transparent');
    });

    document.getElementById(page + 'Page').classList.remove('hidden');
    
    // Find the clicked button and highlight it
    const clickedBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => 
        btn.textContent.toLowerCase().includes(page) || 
        (page === 'timetable' && btn.textContent.toLowerCase().includes('schedule'))
    );
    if (clickedBtn) {
        clickedBtn.classList.add('border-green-500', 'text-green-600');
    }

    currentPage = page;

    if (page === 'events') {
        // Reset to current date when switching to events page
        currentDate = new Date();
        loadCalendar();
    } else if (page === 'status') {
        loadStatusCharts();
    } else if (page === 'timetable') {
        loadTimeTable();
    }
}

 // Disable right-click
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  // Disable common inspect shortcuts
  document.addEventListener("keydown", function (e) {
    // F12
    if (e.key === "F12") {
      e.preventDefault();
    }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) {
      e.preventDefault();
    }
    // Ctrl+U (View source)
    if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
    }
    // Ctrl+S (Save page)
    if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
    }
  });
