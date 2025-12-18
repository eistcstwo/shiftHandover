
from django.urls import path
from . import views
urlpatterns = [
path('saveNew_task/',views.saveTask,name='saveNewTask'),
path('get_Handover/',views.getHandover,name='getHandover'),
path('get_Handover_All/',views.getHandoverAll,name='getHandoverAll'),
path('get_historyHandover/',views.getHistoryHandover,name="getHistoryHandover"),
path('startBrokerRestartTask/',views.startBrokerRestart,name="startBrokerRestart")

]
