#include<iostream>
using namespace std;

int linerSearch(int array[],int size,int target){
     for (int i = 0; i < size; i++){
        if(array[i]==target){
        return i;
        }
    }
    return -1;
}

int main(){
    int array[] = {5,8,6,4,9,25};

    int size = sizeof(array)/sizeof(int);

    int target ;
    cout << "Enter the value of target : ";
    cin >> target;

    cout << linerSearch(array ,size , target) << endl;

    return 0;
}